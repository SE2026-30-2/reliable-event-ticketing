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
public class WaitlistEntry {
    private Long id;
    private UUID entryId;
    private UUID ticketTypeId;
    private String ownerEmail;
    private String holderName;
    private String holderEmail;
    /** Units, as in a reservation (a bundle type multiplies this into tickets). */
    private int quantity;
    private WaitlistStatus status;
    private UUID reservationId;
    private String failureReason;
    private Instant offeredAt;
    private Instant createdAt;
}
