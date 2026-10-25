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
public class Event {
    private Long id;
    private UUID eventId;
    private String name;
    private String venue;
    private Instant startsAt;
    private Instant endsAt;
    private EventStatus status;
    private Instant createdAt;
    /** The account (JWT subject, lower-cased) that owns this event; null = pre-organizer data, ADMIN-only. */
    private String organizerId;
    private String description;
    private String bannerUrl;

    public boolean isOpenForSales(Instant now) {
        return status == EventStatus.PUBLISHED && endsAt.isAfter(now);
    }
}
