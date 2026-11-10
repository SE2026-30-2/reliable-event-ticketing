package com.ticketing.payment.infrastructure.persistence;

import com.ticketing.payment.domain.model.PaymentRequest;
import com.ticketing.payment.domain.model.PaymentStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(PaymentRequestRepositoryAdapter.class)
class PaymentRequestSettlementRepositoryTest {

    @Autowired
    private SpringDataPaymentRequestJpaRepository payments;

    @Autowired
    private PaymentRequestRepositoryAdapter adapter;

    @PersistenceContext
    private EntityManager entityManager;

    @Test
    void onlyOnePendingSettlementCanWin() {
        UUID paymentRequestId = UUID.randomUUID();
        payments.saveAndFlush(PaymentRequestEntity.builder()
                .paymentRequestId(paymentRequestId)
                .reservationId(UUID.randomUUID())
                .amountCents(5_000_000L)
                .status("PENDING")
                .createdAt(Instant.now())
                .provider("VNPAY")
                .txnRef("repo-test-" + paymentRequestId)
                .build());

        Instant completedAt = Instant.now();
        PaymentRequest completed = PaymentRequest.builder().paymentRequestId(paymentRequestId)
                .status(PaymentStatus.COMPLETED).completedAt(completedAt)
                .providerTxnNo("vnp-transaction-1").providerPaidAt("20260101101010").build();
        PaymentRequest staleFailure = PaymentRequest.builder().paymentRequestId(paymentRequestId)
                .status(PaymentStatus.FAILED).completedAt(completedAt).failureReason("stale duplicate result").build();
        boolean firstUpdate = adapter.saveIfPending(completed);
        boolean duplicateUpdate = adapter.saveIfPending(staleFailure);

        entityManager.clear();
        PaymentRequestEntity stored = payments.findByPaymentRequestId(paymentRequestId).orElseThrow();

        assertThat(firstUpdate).isTrue();
        assertThat(duplicateUpdate).isFalse();
        assertThat(stored.getStatus()).isEqualTo("COMPLETED");
        assertThat(stored.getProviderTxnNo()).isEqualTo("vnp-transaction-1");
    }
}
