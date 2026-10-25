package com.techie.microservices.ticketing.checkin.infrastructure.messaging.dto;

import java.time.Instant;
import java.util.UUID;

/** Checkin's own decoupled copy of catalog's {@code domain.event.TicketVoidedEvent} - same
 * "shared JSON shape, not a shared class" convention used throughout this app. */
public record TicketVoidedEvent(UUID eventId, UUID ticketId, UUID eventIdFk, String status, String reason, Instant changedAt) {
}
