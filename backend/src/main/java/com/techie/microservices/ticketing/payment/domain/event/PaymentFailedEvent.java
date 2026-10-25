package com.techie.microservices.ticketing.payment.domain.event;

import com.techie.microservices.ticketing.shared.domain.event.OutboxEvent;

import java.util.UUID;

public record PaymentFailedEvent(UUID eventId, UUID paymentRequestId, UUID reservationId, String reason)
        implements OutboxEvent {
}
