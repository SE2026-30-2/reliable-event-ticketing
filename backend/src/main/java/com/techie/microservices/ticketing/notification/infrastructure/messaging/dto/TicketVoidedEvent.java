package com.techie.microservices.ticketing.notification.infrastructure.messaging.dto;

import java.time.Instant;
import java.util.UUID;

/** See {@link TicketIssuedEvent} for why this is a separate copy from catalog's own class. */
public record TicketVoidedEvent(UUID eventId, UUID ticketId, UUID eventIdFk, String status, String reason, Instant changedAt,
                          String holderName, String holderEmail) {
}
