package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Event;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EventRepositoryPort {
    Event save(Event event);

    Optional<Event> findByEventId(UUID eventId);

    List<Event> findAll();

    /** PUBLISHED events that have not ended, soonest first, optionally filtered by name/venue. */
    List<Event> searchPublic(String query, Instant now, int limit);

    List<Event> findByOrganizer(String organizerId);
}
