package com.techie.microservices.ticketing.payment.application.service;

import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestCommand;
import com.techie.microservices.ticketing.payment.application.port.PaymentGatewayPort;
import com.techie.microservices.ticketing.payment.application.port.PaymentRequestRepositoryPort;
import com.techie.microservices.ticketing.payment.application.port.ReservationPricingPort;
import com.techie.microservices.ticketing.payment.domain.exception.ForceOutcomeNotAllowedException;
import com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotPayableException;
import com.techie.microservices.ticketing.payment.domain.event.PaymentCompletedEvent;
import com.techie.microservices.ticketing.payment.domain.event.PaymentFailedEvent;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CreatePaymentRequestApplicationServiceTest {

    @Mock
    private PaymentRequestRepositoryPort paymentRequestRepositoryPort;
    @Mock
    private PaymentGatewayPort paymentGatewayPort;
    @Mock
    private OutboxEventPublisherPort outboxEventPublisherPort;
    @Mock
    private ReservationPricingPort reservationPricingPort;
    @Mock
    private org.springframework.beans.factory.ObjectProvider<com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort> onlinePaymentProvider;

    private CreatePaymentRequestApplicationService service;

    private static final String BUYER = "buyer@example.com";
    private final UUID reservationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new CreatePaymentRequestApplicationService(
                paymentRequestRepositoryPort, paymentGatewayPort, outboxEventPublisherPort, reservationPricingPort, onlinePaymentProvider);
        ReflectionTestUtils.setField(service, "allowForceOutcome", true);
    }

    @Test
    void chargeSucceedsCreatesCompletedRequestAndPublishesPaymentCompleted() {
        when(paymentRequestRepositoryPort.findByReservationId(reservationId)).thenReturn(Optional.empty());
        when(reservationPricingPort.quote(reservationId, BUYER)).thenReturn(new ReservationPricingPort.Quote(5000L, null));
        when(paymentGatewayPort.charge(anyLong(), any())).thenReturn(true);
        when(paymentRequestRepositoryPort.save(any(PaymentRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentRequest result = service.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservationId, null));

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(result.getAmountCents()).isEqualTo(5000L); // the server's price, not anything the caller sent
        assertThat(result.getReservationId()).isEqualTo(reservationId);
        assertThat(result.getCompletedAt()).isNotNull();

        verify(outboxEventPublisherPort).publish(any(), eq("payment-completed"), eq("payment-completed"), any(PaymentCompletedEvent.class));
        verify(outboxEventPublisherPort, never()).publish(any(), eq("payment-failed"), any(), any());
    }

    @Test
    void chargeFailsCreatesFailedRequestAndPublishesPaymentFailed() {
        when(paymentRequestRepositoryPort.findByReservationId(reservationId)).thenReturn(Optional.empty());
        when(reservationPricingPort.quote(reservationId, BUYER)).thenReturn(new ReservationPricingPort.Quote(5000L, null));
        when(paymentGatewayPort.charge(anyLong(), any())).thenReturn(false);
        when(paymentRequestRepositoryPort.save(any(PaymentRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentRequest result = service.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservationId, "FAILED"));

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.FAILED);

        ArgumentCaptor<PaymentFailedEvent> captor = ArgumentCaptor.forClass(PaymentFailedEvent.class);
        verify(outboxEventPublisherPort).publish(any(), eq("payment-failed"), eq("payment-failed"), captor.capture());
        assertThat(captor.getValue().reservationId()).isEqualTo(reservationId);
    }

    @Test
    void repeatedRequestForSameReservationReturnsExistingOutcomeWithoutChargingAgain() {
        PaymentRequest existing = PaymentRequest.builder()
                .paymentRequestId(UUID.randomUUID())
                .reservationId(reservationId)
                .amountCents(5000)
                .status(PaymentStatus.COMPLETED)
                .build();
        when(paymentRequestRepositoryPort.findByReservationId(reservationId)).thenReturn(Optional.of(existing));

        PaymentRequest result = service.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservationId, null));

        assertThat(result).isSameAs(existing);
        verify(paymentGatewayPort, never()).charge(anyLong(), any());
        verify(outboxEventPublisherPort, never()).publish(any(), any(), any(), any());
    }

    @Test
    void rejectsAnUnpayableReservationBeforeChargingAnything() {
        when(paymentRequestRepositoryPort.findByReservationId(reservationId)).thenReturn(Optional.empty());
        when(reservationPricingPort.quote(reservationId, BUYER))
                .thenThrow(new ReservationNotPayableException(reservationId, "the reservation has expired"));

        assertThatThrownBy(() -> service.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservationId, null)))
                .isInstanceOf(ReservationNotPayableException.class);

        verify(paymentGatewayPort, never()).charge(anyLong(), any());
        verify(outboxEventPublisherPort, never()).publish(any(), any(), any(), any());
    }

    @Test
    void refusesForceOutcomeWhenTheDemoHookIsDisabled() {
        ReflectionTestUtils.setField(service, "allowForceOutcome", false);
        when(paymentRequestRepositoryPort.findByReservationId(reservationId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservationId, "COMPLETED")))
                .isInstanceOf(ForceOutcomeNotAllowedException.class);

        verify(paymentGatewayPort, never()).charge(anyLong(), any());
    }

    @Test
    void someoneElsesReservationIsRejectedEvenWhenAPaymentAlreadyExists() {
        org.mockito.Mockito.doThrow(new com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotFoundException(reservationId))
                .when(reservationPricingPort).assertOwnedBy(reservationId, "attacker@example.com");

        assertThatThrownBy(() -> service.createPaymentRequest(new CreatePaymentRequestCommand("attacker@example.com", reservationId, null)))
                .isInstanceOf(com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotFoundException.class);

        verify(paymentRequestRepositoryPort, never()).findByReservationId(any()); // the stored result is never even looked up
        verify(paymentGatewayPort, never()).charge(anyLong(), any());
    }
}
