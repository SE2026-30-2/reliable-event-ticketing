package com.techie.microservices.ticketing.catalog.domain.event;

import com.techie.microservices.ticketing.shared.domain.event.OutboxEvent;

import java.time.Instant;
import java.util.UUID;

/** A waiting buyer has been given a time-limited hold on tickets - notification emails them the link to pay. */
public record WaitlistOfferedEvent(
        UUID eventId,
        UUID entryId,
        String holderName,
        String holderEmail,
        UUID reservationId,
        String eventName,
        int ticketCount,
        Instant expiresAt
) implements OutboxEvent {
}
