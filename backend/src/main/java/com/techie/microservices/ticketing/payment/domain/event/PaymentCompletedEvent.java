package com.techie.microservices.ticketing.payment.domain.event;

import com.techie.microservices.ticketing.shared.domain.event.OutboxEvent;

import java.util.UUID;

/** Catalog's {@code PaymentEventListener} consumes its own decoupled copy of this shape - see the
 * comment on catalog's {@code infrastructure.messaging.dto.PaymentCompletedEvent}. */
public record PaymentCompletedEvent(UUID eventId, UUID paymentRequestId, UUID reservationId) implements OutboxEvent {
}
