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
        EventStatus status
) {
    /** Platform-owned (no organizer), published immediately - the pre-organizer behaviour. */
    public CreateEventCommand(String name, String venue, Instant startsAt, Instant endsAt) {
        this(name, venue, startsAt, endsAt, null, null, null, EventStatus.PUBLISHED);
    }
}
