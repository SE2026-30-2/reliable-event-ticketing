package com.ticketing.platform.notification.infrastructure.messaging.dto;

import java.time.Instant;
import java.util.UUID;

/** See {@link TicketIssuedEvent} for why this is a separate copy from catalog's own class. */
public record WaitlistOfferedEvent(UUID eventId, UUID entryId, String holderName, String holderEmail, UUID reservationId,
                                   String eventName, int ticketCount, Instant expiresAt) {
}
