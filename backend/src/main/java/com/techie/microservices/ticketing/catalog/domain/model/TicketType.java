package com.techie.microservices.ticketing.catalog.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketType {
    private Long id;
    private UUID ticketTypeId;
    private UUID eventId;
    private String name;
    private long priceCents;
    private int quota;
    private int issuedCount;
    /** Tickets currently held in {@code RESERVED} (not yet paid, not yet released) for this type. */
    private int reservedCount;
    private Instant validFrom;
    private Instant validUntil;
    private Instant createdAt;
    /** Tickets sold together per unit at priceCents (1 = ordinary; 4 = a group-of-four pack). */
    @Builder.Default
    private int bundleSize = 1;
    /** Scans allowed per ticket of this type (1 = single use). */
    @Builder.Default
    private int maxEntries = 1;

    public boolean hasRemainingQuota(int requested) {
        return issuedCount + reservedCount + requested <= quota;
    }
}
