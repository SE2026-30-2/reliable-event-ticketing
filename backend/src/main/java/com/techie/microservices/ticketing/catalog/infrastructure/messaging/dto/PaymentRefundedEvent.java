package com.techie.microservices.ticketing.catalog.infrastructure.messaging.dto;

import java.util.UUID;

/** See {@link PaymentCompletedEvent} for why this is a separate copy from payment's own class. */
public record PaymentRefundedEvent(UUID eventId, UUID paymentRequestId, UUID reservationId) {
}
