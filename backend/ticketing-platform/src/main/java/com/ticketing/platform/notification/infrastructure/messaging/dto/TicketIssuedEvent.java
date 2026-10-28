package com.ticketing.platform.notification.infrastructure.messaging.dto;

import java.time.Instant;
import java.util.UUID;

/** Notification's own decoupled copy of catalog's {@code domain.event.TicketIssuedEvent} - same
 * "shared JSON shape, not a shared class" convention used throughout this app. */
public record TicketIssuedEvent(
        UUID eventId, UUID ticketId, UUID eventIdFk, UUID ticketTypeId,
        String holderName, String holderEmail, String qrPayload,
        Instant validFrom, Instant validUntil, Instant issuedAt
) {
}
