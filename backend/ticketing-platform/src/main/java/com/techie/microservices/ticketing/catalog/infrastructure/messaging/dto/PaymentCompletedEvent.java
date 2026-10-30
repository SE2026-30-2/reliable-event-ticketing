package com.techie.microservices.ticketing.catalog.infrastructure.messaging.dto;

import java.util.UUID;

/**
 * Catalog's own copy of the payment module's outcome event - deliberately a separate class from
 * {@code payment.domain.event.PaymentCompletedEvent} (only the JSON shape is the shared contract,
 * same "decoupled by design" convention notification-service already uses for user-service's
 * email-verification/password-reset events).
 */
public record PaymentCompletedEvent(UUID eventId, UUID reservationId, UUID paymentRequestId) {
}
