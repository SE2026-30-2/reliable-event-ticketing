package com.ticketing.catalog.web.dto;

import com.ticketing.catalog.domain.model.EventStatus;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/** Every field optional - only what is sent changes. */
public record UpdateEventRequest(
        @Size(max = 255) String name,
        @Size(max = 255) String venue,
        @Size(max = 5000) String description,
        @Size(max = 500) String bannerUrl,
        Instant startsAt,
        Instant endsAt,
        EventStatus status,
        com.ticketing.catalog.domain.model.EventCategory category,
        Instant salesStartAt,
        Instant salesEndAt,
        boolean clearSalesSchedule
) {
}
