package com.techie.microservices.ticketing.catalog.domain.event;

import com.techie.microservices.ticketing.shared.domain.event.OutboxEvent;

import java.time.Instant;
import java.util.UUID;

/** Asks the notification module to email an already-issued ticket again. Same shape as
 * {@link TicketIssuedEvent} on purpose (the email is identical) but a distinct topic, so a resend
 * is never mistaken for a new issuance by anything consuming {@code ticket-issued}. */
public record TicketResendRequestedEvent(
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
