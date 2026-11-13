package com.ticketing.payment.infrastructure.persistence;

import com.ticketing.payment.application.port.OnlinePaymentPort;
import com.ticketing.payment.application.port.ReservationPricingPort;
import com.ticketing.payment.application.service.OnlinePaymentApplicationService;
import com.ticketing.payment.domain.model.PaymentStatus;
import com.ticketing.shared.infrastructure.persistence.OutboxEventPublisherAdapter;
import com.ticketing.shared.infrastructure.persistence.SpringDataOutboxEventJpaRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Exercises the real H2 transaction boundary around payment CAS and outbox publication. */
@DataJpaTest
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import({PaymentRequestRepositoryAdapter.class, OnlinePaymentApplicationService.class,
        OutboxEventPublisherAdapter.class, PaymentSyncTestConfiguration.class})
@TestPropertySource(properties = "ticketing.payment.provider=vnpay")
class PaymentSyncTransactionIntegrationTest {

    private static final String BUYER = "vt048-transaction@example.test";

    @Autowired
    private SpringDataPaymentRequestJpaRepository payments;

    @Autowired
    private OnlinePaymentApplicationService service;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private SpringDataOutboxEventJpaRepository outboxRows;

    @MockBean
    private OnlinePaymentPort provider;

    @SpyBean
    private OutboxEventPublisherAdapter outbox;

    @MockBean
    private ReservationPricingPort reservations;

    @Test
    void outboxFailureRollsBackThePendingOnlySettlementUpdate() {
        SeededPayment payment = seedPayment("vt048-rollback-" + UUID.randomUUID());
        when(provider.query(any())).thenReturn(successfulTransaction(payment.amountCents()));
        when(reservations.isStillHeld(payment.reservationId())).thenReturn(true);
        doAnswer(invocation -> {
            invocation.callRealMethod();
            outboxRows.flush(); // execute the INSERT before simulating failure after the write
            throw new DataAccessResourceFailureException("outbox insert unavailable");
        }).when(outbox).publish(anyString(), eq("payment-completed"), eq("payment-completed"), any());

        assertThatThrownBy(() -> service.sync(payment.txnRef(), BUYER))
                .isInstanceOf(DataAccessResourceFailureException.class)
                .hasMessageContaining("outbox insert unavailable");

        PaymentRequestEntity stored = findPayment(payment.paymentRequestId());
        assertThat(stored.getStatus()).isEqualTo("PENDING");
        assertThat(stored.getCompletedAt()).isNull();
        assertThat(countOutboxRows(payment.paymentRequestId())).isZero();
        verify(outbox, times(1)).publish(anyString(), eq("payment-completed"), eq("payment-completed"), any());
    }

    @Test
    void concurrentSyncCallsForOnePaymentPublishOneEventAndKeepOneTerminalState() throws Exception {
        SeededPayment payment = seedPayment("vt048-race-" + UUID.randomUUID());
        CyclicBarrier bothQueriesReadPending = new CyclicBarrier(2);
        when(provider.query(any())).thenAnswer(invocation -> {
            bothQueriesReadPending.await(5, TimeUnit.SECONDS);
            return successfulTransaction(payment.amountCents());
        });
        when(reservations.isStillHeld(payment.reservationId())).thenReturn(true);

        ExecutorService callers = Executors.newFixedThreadPool(2);
        try {
            Future<PaymentStatus> first = callers.submit(() -> service.sync(payment.txnRef(), BUYER).getStatus());
            Future<PaymentStatus> second = callers.submit(() -> service.sync(payment.txnRef(), BUYER).getStatus());

            assertThat(first.get(10, TimeUnit.SECONDS)).isEqualTo(PaymentStatus.COMPLETED);
            assertThat(second.get(10, TimeUnit.SECONDS)).isEqualTo(PaymentStatus.COMPLETED);
        } finally {
            callers.shutdownNow();
            assertThat(callers.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }

        PaymentRequestEntity stored = findPayment(payment.paymentRequestId());
        assertThat(stored.getStatus()).isEqualTo("COMPLETED");
        assertThat(stored.getProviderTxnNo()).isEqualTo("vnp-vt048");
        assertThat(countOutboxRows(payment.paymentRequestId())).isEqualTo(1);
        verify(provider, times(2)).query(any());
        verify(outbox, times(1)).publish(anyString(), eq("payment-completed"), eq("payment-completed"), any());
    }

    private SeededPayment seedPayment(String txnRef) {
        UUID paymentRequestId = UUID.randomUUID();
        UUID reservationId = UUID.randomUUID();
        long amountCents = 5_000_000L;
        inTransaction(() -> payments.saveAndFlush(PaymentRequestEntity.builder()
                .paymentRequestId(paymentRequestId)
                .reservationId(reservationId)
                .amountCents(amountCents)
                .status("PENDING")
                .createdAt(Instant.now())
                .provider("VNPAY")
                .txnRef(txnRef)
                .providerCreatedAt("20260101070000")
                .build()));
        return new SeededPayment(paymentRequestId, reservationId, amountCents, txnRef);
    }

    private PaymentRequestEntity findPayment(UUID paymentRequestId) {
        return inTransaction(() -> {
            entityManager.clear();
            return payments.findByPaymentRequestId(paymentRequestId).orElseThrow();
        });
    }

    private int countOutboxRows(UUID paymentRequestId) {
        return inTransaction(() -> jdbc.queryForObject(
                "select count(*) from outbox_events where aggregate_id = ?", Integer.class, paymentRequestId.toString()));
    }

    private <T> T inTransaction(java.util.function.Supplier<T> work) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return tx.execute(status -> work.get());
    }

    private static OnlinePaymentPort.ProviderTransaction successfulTransaction(long amountCents) {
        return new OnlinePaymentPort.ProviderTransaction(OnlinePaymentPort.TransactionState.SUCCESS,
                amountCents, "vnp-vt048", "20261110120000", "OK");
    }

    private record SeededPayment(UUID paymentRequestId, UUID reservationId, long amountCents, String txnRef) {
    }

}
