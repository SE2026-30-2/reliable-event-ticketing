package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;

import java.time.Instant;
import java.util.UUID;

/** Every field except the id is optional: null = leave unchanged. */
public record UpdateEventCommand(
        UUID eventId,
        String name,
        String venue,
        String description,
        String bannerUrl,
        Instant startsAt,
        Instant endsAt,
        EventStatus status
) {
}
