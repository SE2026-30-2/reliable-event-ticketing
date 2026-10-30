package com.techie.microservices.ticketing.payment.application.service;

import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort.ProviderCallback;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort.ProviderTransaction;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort.RefundResult;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort.TransactionState;
import com.techie.microservices.ticketing.payment.application.port.PaymentRequestRepositoryPort;
import com.techie.microservices.ticketing.payment.application.port.ReservationPricingPort;
import com.techie.microservices.ticketing.payment.domain.event.PaymentCompletedEvent;
import com.techie.microservices.ticketing.payment.domain.event.PaymentFailedEvent;
import com.techie.microservices.ticketing.payment.domain.event.PaymentRefundedEvent;
import com.techie.microservices.ticketing.payment.domain.exception.PaymentNotFoundException;
import com.techie.microservices.ticketing.payment.domain.exception.PaymentNotRefundableException;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OnlinePaymentApplicationServiceTest {

    @Mock
    private PaymentRequestRepositoryPort repository;
    @Mock
    private OnlinePaymentPort provider;
    @Mock
    private OutboxEventPublisherPort outbox;
    @Mock
    private ReservationPricingPort reservations;

    private OnlinePaymentApplicationService service;

    private static final String BUYER = "buyer@example.com";
    private final UUID reservationId = UUID.randomUUID();
    private PaymentRequest pending;

    @BeforeEach
    void setUp() {
        service = new OnlinePaymentApplicationService(repository, provider, outbox, reservations, 90, 120);
        pending = PaymentRequest.builder().paymentRequestId(UUID.randomUUID()).reservationId(reservationId)
                .amountCents(5_000_000L).status(PaymentStatus.PENDING).provider("VNPAY").txnRef("ref1")
                .createdAt(Instant.now()).payExpiresAt(Instant.now().plus(Duration.ofMinutes(10))).build();
    }

    private ProviderCallback cb(long amount, boolean success) {
        return new ProviderCallback("ref1", amount, success, "999", "20260101101010", success ? "00" : "24");
    }

    @Test
    void ipnWithBadSignatureChangesNothing() {
        when(provider.verifyCallback(any())).thenReturn(Optional.empty());
        assertThat(service.handleIpn(Map.of())).containsEntry("RspCode", "97");
        verifyNoInteractions(repository, outbox);
    }

    @Test
    void ipnUnknownOrderIs01() {
        when(provider.verifyCallback(any())).thenReturn(Optional.of(cb(5_000_000L, true)));
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.empty());
        assertThat(service.handleIpn(Map.of())).containsEntry("RspCode", "01");
    }

    @Test
    void ipnWithWrongAmountIsRejectedAndLeavesPaymentPending() {
        when(provider.verifyCallback(any())).thenReturn(Optional.of(cb(1L, true)));
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.of(pending));
        assertThat(service.handleIpn(Map.of())).containsEntry("RspCode", "04");
        assertThat(pending.getStatus()).isEqualTo(PaymentStatus.PENDING);
        verify(outbox, never()).publish(any(), any(), any(), any());
    }

    @Test
    void successfulIpnCompletesPaymentAndPublishesPaymentCompleted() {
        when(provider.verifyCallback(any())).thenReturn(Optional.of(cb(5_000_000L, true)));
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.of(pending));
        when(reservations.isStillHeld(reservationId)).thenReturn(true);

        assertThat(service.handleIpn(Map.of())).containsEntry("RspCode", "00");

        assertThat(pending.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(pending.getProviderTxnNo()).isEqualTo("999");
        verify(repository).save(pending);
        verify(outbox).publish(any(), eq("payment-completed"), eq("payment-completed"), any(PaymentCompletedEvent.class));
    }

    @Test
    void failedIpnFailsPaymentAndPublishesPaymentFailed() {
        when(provider.verifyCallback(any())).thenReturn(Optional.of(cb(5_000_000L, false)));
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.of(pending));

        assertThat(service.handleIpn(Map.of())).containsEntry("RspCode", "00");

        assertThat(pending.getStatus()).isEqualTo(PaymentStatus.FAILED);
        verify(outbox).publish(any(), eq("payment-failed"), eq("payment-failed"), any(PaymentFailedEvent.class));
    }

    @Test
    void duplicateIpnDeliveryIsANoOpAnswered02() {
        pending.setStatus(PaymentStatus.COMPLETED);
        when(provider.verifyCallback(any())).thenReturn(Optional.of(cb(5_000_000L, true)));
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.of(pending));

        assertThat(service.handleIpn(Map.of())).containsEntry("RspCode", "02");
        verify(repository, never()).save(any());
        verify(outbox, never()).publish(any(), any(), any(), any());
    }

    @Test
    void paidButReservationGoneBecomesRefundRequiredWithNoTicketEvent() {
        when(provider.verifyCallback(any())).thenReturn(Optional.of(cb(5_000_000L, true)));
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.of(pending));
        when(reservations.isStillHeld(reservationId)).thenReturn(false);

        service.handleIpn(Map.of());

        assertThat(pending.getStatus()).isEqualTo(PaymentStatus.REFUND_REQUIRED);
        verify(outbox, never()).publish(any(), any(), any(), any());
    }

    @Test
    void syncSettlesFromProviderQuery() {
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.of(pending));
        when(provider.query(pending)).thenReturn(new ProviderTransaction(TransactionState.SUCCESS, 5_000_000L, "999", "20260101101010", "ok"));
        when(reservations.isStillHeld(reservationId)).thenReturn(true);

        PaymentRequest result = service.sync("ref1", BUYER);

        verify(reservations).assertOwnedBy(reservationId, BUYER);
        assertThat(result.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
    }

    @Test
    void syncOfSomeoneElsesPaymentIsRefusedBeforeAskingTheProvider() {
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.of(pending));
        org.mockito.Mockito.doThrow(new PaymentNotFoundException("x")).when(reservations).assertOwnedBy(reservationId, "evil@x.com");
        assertThatThrownBy(() -> service.sync("ref1", "evil@x.com")).isInstanceOf(PaymentNotFoundException.class);
        verifyNoInteractions(provider);
    }

    @Test
    void syncKeepsPendingWhenTheProviderIsUnreachable() {
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.of(pending));
        when(provider.query(pending)).thenThrow(new IllegalStateException("timeout"));
        assertThat(service.sync("ref1", BUYER).getStatus()).isEqualTo(PaymentStatus.PENDING);
    }

    @Test
    void syncDoesNotFailAPaymentThatIsMerelyStillOpen() {
        when(repository.findByTxnRef("ref1")).thenReturn(Optional.of(pending));
        when(provider.query(pending)).thenReturn(new ProviderTransaction(TransactionState.NOT_FOUND, 0, null, null, "none"));
        assertThat(service.sync("ref1", BUYER).getStatus()).isEqualTo(PaymentStatus.PENDING); // buyer may still be paying
    }

    @Test
    void reconcileFailsAPaymentPastItsDeadlineThatTheProviderNeverSaw() {
        pending.setPayExpiresAt(Instant.now().minus(Duration.ofMinutes(10)));
        pending.setCreatedAt(Instant.now().minus(Duration.ofMinutes(20)));
        when(repository.findByStatusAndProvider(PaymentStatus.PENDING, "VNPAY")).thenReturn(List.of(pending));
        when(repository.findByStatusAndProvider(PaymentStatus.REFUND_REQUIRED, "VNPAY")).thenReturn(List.of());
        when(provider.query(pending)).thenReturn(new ProviderTransaction(TransactionState.NOT_FOUND, 0, null, null, "none"));

        service.reconcile();

        assertThat(pending.getStatus()).isEqualTo(PaymentStatus.FAILED);
        verify(outbox).publish(any(), eq("payment-failed"), eq("payment-failed"), any(PaymentFailedEvent.class));
    }

    @Test
    void reconcileLeavesFreshPaymentsAlone() {
        when(repository.findByStatusAndProvider(PaymentStatus.PENDING, "VNPAY")).thenReturn(List.of(pending));
        when(repository.findByStatusAndProvider(PaymentStatus.REFUND_REQUIRED, "VNPAY")).thenReturn(List.of());
        service.reconcile();
        verifyNoInteractions(provider);
    }

    @Test
    void reconcileRefundsOrphanPayments() {
        pending.setStatus(PaymentStatus.REFUND_REQUIRED);
        when(repository.findByStatusAndProvider(PaymentStatus.PENDING, "VNPAY")).thenReturn(List.of());
        when(repository.findByStatusAndProvider(PaymentStatus.REFUND_REQUIRED, "VNPAY")).thenReturn(List.of(pending));
        when(provider.refund(pending, "system")).thenReturn(new RefundResult(true, "00"));

        service.reconcile();

        assertThat(pending.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        verify(outbox, never()).publish(any(), any(), any(), any()); // no tickets were ever issued
    }

    @Test
    void adminRefundMarksRefundedAndPublishesEventToVoidTickets() {
        pending.setStatus(PaymentStatus.COMPLETED);
        when(repository.findByPaymentRequestId(pending.getPaymentRequestId())).thenReturn(Optional.of(pending));
        when(provider.refund(pending, "admin@x.com")).thenReturn(new RefundResult(true, "00 ok"));

        service.refund(pending.getPaymentRequestId(), "admin@x.com");

        assertThat(pending.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        verify(outbox).publish(any(), eq("payment-refunded"), eq("payment-refunded"), any(PaymentRefundedEvent.class));
    }

    @Test
    void refundOfNonCompletedOrRefusedRefundChangesNothing() {
        when(repository.findByPaymentRequestId(pending.getPaymentRequestId())).thenReturn(Optional.of(pending));
        assertThatThrownBy(() -> service.refund(pending.getPaymentRequestId(), "a")).isInstanceOf(PaymentNotRefundableException.class);

        pending.setStatus(PaymentStatus.COMPLETED);
        when(provider.refund(pending, "a")).thenReturn(new RefundResult(false, "02 rejected"));
        assertThatThrownBy(() -> service.refund(pending.getPaymentRequestId(), "a")).isInstanceOf(PaymentNotRefundableException.class);
        assertThat(pending.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        verify(outbox, never()).publish(any(), any(), any(), any());
    }
}
