package com.techie.microservices.ticketing.catalog.web.dto;

import com.techie.microservices.ticketing.catalog.domain.model.TicketType;

import java.time.Instant;
import java.util.UUID;

public record TicketTypeResponse(
        UUID ticketTypeId,
        UUID eventId,
        String name,
        long priceCents,
        int quota,
        int issuedCount,
        /** What can still be reserved right now: quota minus sold AND currently held. */
        int remaining,
        Instant validFrom,
        Instant validUntil,
        int maxEntries,
        int bundleSize
) {
    public static TicketTypeResponse from(TicketType ticketType) {
        return new TicketTypeResponse(
                ticketType.getTicketTypeId(),
                ticketType.getEventId(),
                ticketType.getName(),
                ticketType.getPriceCents(),
                ticketType.getQuota(),
                ticketType.getIssuedCount(),
                Math.max(0, ticketType.getQuota() - ticketType.getIssuedCount() - ticketType.getReservedCount()),
                ticketType.getValidFrom(),
                ticketType.getValidUntil(),
                ticketType.getMaxEntries(),
                ticketType.getBundleSize());
    }
}
