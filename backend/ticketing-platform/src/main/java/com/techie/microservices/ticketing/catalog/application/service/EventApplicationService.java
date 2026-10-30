package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.CreateEventCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.GetEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListEventsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.UpdateEventCommand;
import com.techie.microservices.ticketing.catalog.application.port.UpdateEventUseCase;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidEventChangeException;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import com.techie.microservices.ticketing.shared.domain.Actor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class EventApplicationService implements CreateEventUseCase, GetEventUseCase, ListEventsUseCase, UpdateEventUseCase {

    private static final int PUBLIC_LIST_LIMIT = 100;

    private final EventRepositoryPort eventRepositoryPort;

    @Override
    public Event createEvent(CreateEventCommand command) {
        EventStatus status = command.status() == null ? EventStatus.PUBLISHED : command.status();
        if (status != EventStatus.DRAFT && status != EventStatus.PUBLISHED) {
            throw new InvalidEventChangeException("A new event can only start as DRAFT or PUBLISHED");
        }
        if (!command.endsAt().isAfter(command.startsAt())) {
            throw new InvalidEventChangeException("endsAt must be after startsAt");
        }
        Event event = Event.builder()
                .eventId(UUID.randomUUID())
                .name(command.name())
                .venue(command.venue())
                .startsAt(command.startsAt())
                .endsAt(command.endsAt())
                .status(status)
                .createdAt(Instant.now())
                .organizerId(command.organizerId() == null ? null : command.organizerId().trim().toLowerCase())
                .description(command.description())
                .bannerUrl(command.bannerUrl())
                .build();
        return eventRepositoryPort.save(event);
    }

    @Override
    public Event updateEvent(UpdateEventCommand command) {
        Event event = eventRepositoryPort.findByEventId(command.eventId())
                .orElseThrow(() -> new EventNotFoundException(command.eventId()));
        if (command.name() != null) {
            if (command.name().isBlank()) {
                throw new InvalidEventChangeException("name must not be blank");
            }
            event.setName(command.name());
        }
        if (command.venue() != null) event.setVenue(command.venue());
        if (command.description() != null) event.setDescription(command.description());
        if (command.bannerUrl() != null) event.setBannerUrl(command.bannerUrl());
        if (command.startsAt() != null) event.setStartsAt(command.startsAt());
        if (command.endsAt() != null) event.setEndsAt(command.endsAt());
        if (!event.getEndsAt().isAfter(event.getStartsAt())) {
            throw new InvalidEventChangeException("endsAt must be after startsAt");
        }
        if (command.status() != null && command.status() != event.getStatus()) {
            event.setStatus(checkedTransition(event.getStatus(), command.status()));
        }
        return eventRepositoryPort.save(event);
    }

    /** DRAFT -> PUBLISHED | CANCELLED, PUBLISHED -> CANCELLED. Nothing goes back to DRAFT once public
     * (buyers may already hold tickets) and CANCELLED/COMPLETED are final. */
    private static EventStatus checkedTransition(EventStatus from, EventStatus to) {
        boolean ok = (from == EventStatus.DRAFT && (to == EventStatus.PUBLISHED || to == EventStatus.CANCELLED))
                || (from == EventStatus.PUBLISHED && to == EventStatus.CANCELLED);
        if (!ok) {
            throw new InvalidEventChangeException("Cannot change an event from " + from + " to " + to);
        }
        return to;
    }

    @Override
    @Transactional(readOnly = true)
    public Event getEvent(UUID eventId) {
        return eventRepositoryPort.findByEventId(eventId)
                .orElseThrow(() -> new EventNotFoundException(eventId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Event> listEvents() {
        return eventRepositoryPort.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Event> listPublicEvents(String query) {
        return eventRepositoryPort.searchPublic(query, Instant.now(), PUBLIC_LIST_LIMIT);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Event> listManageableEvents(Actor actor) {
        return actor.admin() ? eventRepositoryPort.findAll() : eventRepositoryPort.findByOrganizer(actor.email());
    }
}
