package com.ticketing.catalog.application.service;

import com.ticketing.catalog.application.port.CreateEventCommand;
import com.ticketing.catalog.application.port.CreateEventUseCase;
import com.ticketing.catalog.application.port.EventRepositoryPort;
import com.ticketing.catalog.application.port.GetEventUseCase;
import com.ticketing.catalog.application.port.ListEventsUseCase;
import com.ticketing.catalog.application.port.UpdateEventCommand;
import com.ticketing.catalog.application.port.UpdateEventUseCase;
import com.ticketing.catalog.domain.exception.EventNotFoundException;
import com.ticketing.catalog.domain.exception.InvalidEventChangeException;
import com.ticketing.catalog.domain.model.Event;
import com.ticketing.catalog.domain.model.EventStatus;
import com.ticketing.shared.domain.Actor;
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
                .category(command.category()).salesStartAt(command.salesStartAt()).salesEndAt(command.salesEndAt())
                .build();
        validateSalesSchedule(event);
        return eventRepositoryPort.save(event);
    }

    @Override
    public Event updateEvent(UpdateEventCommand command) {
        Event event = eventRepositoryPort.findByEventId(command.eventId())
                .orElseThrow(() -> new EventNotFoundException(command.eventId()));
        if (event.getStatus() == EventStatus.CANCELLED || event.getStatus() == EventStatus.COMPLETED) {
            throw new InvalidEventChangeException("Cannot edit a cancelled or completed event");
        }
        if (command.category() != null) event.setCategory(command.category());
        if (command.clearSalesSchedule()) {
            if (command.salesStartAt() != null || command.salesEndAt() != null) {
                throw new InvalidEventChangeException("Cannot clear and set the sales schedule together");
            }
            event.setSalesStartAt(null); event.setSalesEndAt(null);
        } else {
            if (command.salesStartAt() != null) event.setSalesStartAt(command.salesStartAt());
            if (command.salesEndAt() != null) event.setSalesEndAt(command.salesEndAt());
        }
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
        validateSalesSchedule(event);
        return eventRepositoryPort.save(event);
    }

    private static void validateSalesSchedule(Event event) {
        Instant from = event.getSalesStartAt(), until = event.getSalesEndAt();
        if ((from == null) != (until == null) || (from != null &&
                (!until.isAfter(from) || until.isAfter(event.getEndsAt())))) {
            throw new InvalidEventChangeException("Sales require both dates; closing must follow opening and be no later than event end");
        }
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
