package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;

import java.time.Instant;

public record CreateEventCommand(
        String name,
        String venue,
        Instant startsAt,
        Instant endsAt,
        String organizerId,
        String description,
        String bannerUrl,
        EventStatus status,
        com.techie.microservices.ticketing.catalog.domain.model.EventCategory category,
        Instant salesStartAt,
        Instant salesEndAt
) {
    public CreateEventCommand(String name, String venue, Instant startsAt, Instant endsAt, String organizerId,
                              String description, String bannerUrl, EventStatus status) {
        this(name, venue, startsAt, endsAt, organizerId, description, bannerUrl, status, null, null, null);
    }
    /** Platform-owned (no organizer), published immediately - the pre-organizer behaviour. */
    public CreateEventCommand(String name, String venue, Instant startsAt, Instant endsAt) {
        this(name, venue, startsAt, endsAt, null, null, null, EventStatus.PUBLISHED);
    }
}
