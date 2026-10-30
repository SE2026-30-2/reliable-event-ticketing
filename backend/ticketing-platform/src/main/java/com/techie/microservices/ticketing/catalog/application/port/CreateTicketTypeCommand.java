package com.techie.microservices.ticketing.catalog.application.port;

import java.time.Instant;
import java.util.UUID;

public record CreateTicketTypeCommand(
        UUID eventId,
        String name,
        long priceCents,
        int quota,
        Instant validFrom,
        Instant validUntil,
        /** Scans allowed per ticket; 1 = single use. */
        int maxEntries,
        /** Tickets per sold unit at priceCents; 1 = ordinary tickets, 4 = a pack of four. */
        int bundleSize
) {
    public CreateTicketTypeCommand(UUID eventId, String name, long priceCents, int quota, Instant validFrom, Instant validUntil) {
        this(eventId, name, priceCents, quota, validFrom, validUntil, 1, 1);
    }
}
