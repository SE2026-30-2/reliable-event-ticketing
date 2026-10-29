package com.ticketing.platform.notification.infrastructure.messaging.dto;

import java.time.Instant;
import java.util.UUID;

/** Notification's own copy of catalog's resend event - same shape as {@link TicketIssuedEvent}. */
public record TicketResendRequestedEvent(
        UUID eventId, UUID ticketId, UUID eventIdFk, UUID ticketTypeId,
        String holderName, String holderEmail, String qrPayload,
        Instant validFrom, Instant validUntil, Instant issuedAt
) {
    public TicketIssuedEvent asIssuedEvent() {
        return new TicketIssuedEvent(eventId, ticketId, eventIdFk, ticketTypeId, holderName, holderEmail,
                qrPayload, validFrom, validUntil, issuedAt);
    }
}
