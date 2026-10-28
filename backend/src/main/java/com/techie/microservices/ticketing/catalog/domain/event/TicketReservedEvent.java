package com.techie.microservices.ticketing.catalog.domain.event;

import com.techie.microservices.ticketing.shared.domain.event.OutboxEvent;

import java.time.Instant;
import java.util.UUID;

/**
 * Published when a ticket is reserved (quota held, awaiting payment). Nothing in this app
 * consumes it today - it exists for audit/traceability alongside {@code ticket-issued}/{@code
 * ticket-voided}, same as every other state change in this domain being observable on the bus.
 */
public record TicketReservedEvent(
        UUID eventId,
        UUID ticketId,
        UUID reservationId,
        UUID eventIdFk,
        UUID ticketTypeId,
        Instant reservationExpiresAt,
        Instant reservedAt
) implements OutboxEvent {
}
