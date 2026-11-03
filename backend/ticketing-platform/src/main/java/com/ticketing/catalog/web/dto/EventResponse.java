package com.ticketing.catalog.web.dto;

import com.ticketing.catalog.domain.model.Event;

import java.time.Instant;
import java.util.UUID;

/** The organizer's identity (an email) is deliberately not exposed on this public shape. */
public record EventResponse(
        UUID eventId,
        String name,
        String venue,
        Instant startsAt,
        Instant endsAt,
        String status,
        String description,
        String bannerUrl,
        com.ticketing.catalog.domain.model.EventCategory category,
        Instant salesStartAt,
        Instant salesEndAt,
        Instant createdAt
) {
    public static EventResponse from(Event event) {
        return new EventResponse(
                event.getEventId(),
                event.getName(),
                event.getVenue(),
                event.getStartsAt(),
                event.getEndsAt(),
                event.getStatus().name(),
                event.getDescription(),
                event.getBannerUrl(), event.getCategory(), event.getSalesStartAt(), event.getSalesEndAt(), event.getCreatedAt());
    }
}
