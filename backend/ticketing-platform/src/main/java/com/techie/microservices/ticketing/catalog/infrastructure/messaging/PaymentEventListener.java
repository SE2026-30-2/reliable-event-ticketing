package com.techie.microservices.ticketing.catalog.infrastructure.messaging;

import com.techie.microservices.ticketing.catalog.application.port.CancelReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.CancelReservationUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ConfirmReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.ConfirmReservationUseCase;
import com.techie.microservices.ticketing.catalog.infrastructure.messaging.dto.PaymentCompletedEvent;
import com.techie.microservices.ticketing.catalog.infrastructure.messaging.dto.PaymentFailedEvent;
import com.techie.microservices.ticketing.catalog.infrastructure.messaging.dto.PaymentRefundedEvent;
import com.techie.microservices.ticketing.catalog.application.port.RefundReservationUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumes the payment module's outcome events to resolve a reservation. No separate event-id
 * dedup table here: {@link ConfirmReservationUseCase}/{@link CancelReservationUseCase} are both
 * idempotent against redelivery on their own (they gate on the tickets' current status), which is
 * what the at-least-once outbox relay (shared by every producer in this app, payment's included)
 * requires of its consumers.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PaymentEventListener {

    private final ConfirmReservationUseCase confirmReservationUseCase;
    private final CancelReservationUseCase cancelReservationUseCase;
    private final RefundReservationUseCase refundReservationUseCase;

    @KafkaListener(topics = "${kafka.topic.payment-completed}", groupId = "ticketing-platform-catalog")
    public void onPaymentCompleted(PaymentCompletedEvent event) {
        confirmReservationUseCase.confirmReservation(new ConfirmReservationCommand(event.reservationId()));
    }

    @KafkaListener(topics = "${kafka.topic.payment-failed}", groupId = "ticketing-platform-catalog")
    public void onPaymentFailed(PaymentFailedEvent event) {
        cancelReservationUseCase.cancelReservation(
                new CancelReservationCommand(event.reservationId(), "payment failed: " + event.reason()));
    }

    @KafkaListener(topics = "${kafka.topic.payment-refunded}", groupId = "ticketing-platform-catalog")
    public void onPaymentRefunded(PaymentRefundedEvent event) {
        refundReservationUseCase.refundReservation(event.reservationId());
    }
}
