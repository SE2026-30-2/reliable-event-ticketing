package com.techie.microservices.ticketing.catalog.domain.event;

import com.techie.microservices.ticketing.shared.domain.event.OutboxEvent;

import java.time.Instant;
import java.util.UUID;

/**
 * Published when a ticket transitions ISSUED -> VOID/REFUNDED after issuance. Consumed by
 * checkin-service to update its {@code valid_tickets} cache so a subsequent check-in attempt for
 * this ticket is rejected even though the original signed QR payload can never reflect this
 * (status changes happen after the QR was already signed and possibly printed/distributed).
 */
public record TicketVoidedEvent(
        UUID eventId,
        UUID ticketId,
        UUID eventIdFk,
        String status,
        String reason,
        Instant changedAt,
        /** Who held the ticket - so notification can tell them; null on older events. */
        String holderName,
        String holderEmail
) implements OutboxEvent {
}
