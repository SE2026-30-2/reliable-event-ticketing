package com.techie.microservices.ticketing.catalog.domain.event;

import com.techie.microservices.ticketing.shared.domain.event.OutboxEvent;

import java.time.Instant;
import java.util.UUID;

/**
 * Published when a ticket is issued. Consumed by checkin-service (populates its {@code
 * valid_tickets} cache - identity fields only, it re-verifies the signature itself and never
 * trusts this event's fields for that) and by notification-service (emails {@code qrPayload}
 * rendered as a QR image to {@code holderEmail}).
 */
public record TicketIssuedEvent(
        UUID eventId,
        UUID ticketId,
        UUID eventIdFk,
        UUID ticketTypeId,
        String holderName,
        String holderEmail,
        String qrPayload,
        Instant validFrom,
        Instant validUntil,
        Instant issuedAt
) implements OutboxEvent {
}
