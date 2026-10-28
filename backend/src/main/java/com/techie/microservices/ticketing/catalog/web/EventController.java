package com.techie.microservices.ticketing.catalog.web;

import com.techie.microservices.ticketing.catalog.application.port.CreateEventCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.GetEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListEventsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.UpdateEventCommand;
import com.techie.microservices.ticketing.catalog.application.port.UpdateEventUseCase;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import com.techie.microservices.ticketing.catalog.web.dto.CreateEventRequest;
import com.techie.microservices.ticketing.catalog.web.dto.EventResponse;
import com.techie.microservices.ticketing.catalog.web.dto.UpdateEventRequest;
import com.techie.microservices.ticketing.shared.web.AuthenticatedUser;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class EventController {

    private final CreateEventUseCase createEventUseCase;
    private final GetEventUseCase getEventUseCase;
    private final ListEventsUseCase listEventsUseCase;
    private final UpdateEventUseCase updateEventUseCase;
    private final ManagementAccess access;

    /** ADMIN or ORGANIZER. The creator becomes the event's organizer. */
    @PostMapping("/api/event")
    public ResponseEntity<EventResponse> createEvent(@Valid @RequestBody CreateEventRequest request,
                                                     @AuthenticationPrincipal Jwt jwt) {
        var event = createEventUseCase.createEvent(new CreateEventCommand(
                request.name(), request.venue(), request.startsAt(), request.endsAt(),
                AuthenticatedUser.email(jwt), request.description(), request.bannerUrl(), request.status()));
        return ResponseEntity.status(HttpStatus.CREATED).body(EventResponse.from(event));
    }

    /** Public: published events that have not ended, soonest first; {@code q} filters name/venue. */
    @GetMapping("/api/event")
    public List<EventResponse> listEvents(@RequestParam(required = false) String q) {
        return listEventsUseCase.listPublicEvents(q).stream().map(EventResponse::from).toList();
    }

    /** ADMIN: every event; ORGANIZER: their own - any status (this is where drafts are visible). */
    @GetMapping("/api/manage/events")
    public List<EventResponse> listManageableEvents(@AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        return listEventsUseCase.listManageableEvents(access.actor(jwt, authentication)).stream().map(EventResponse::from).toList();
    }

    /** Public for published events; a draft or cancelled event is 404 unless the caller manages it. */
    @GetMapping("/api/event/{eventId}")
    public EventResponse getEvent(@PathVariable UUID eventId, @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        Event event = getEventUseCase.getEvent(eventId);
        if (event.getStatus() != EventStatus.PUBLISHED && !access.canManage(eventId, jwt, authentication)) {
            throw new EventNotFoundException(eventId);
        }
        return EventResponse.from(event);
    }

    @PatchMapping("/api/event/{eventId}")
    public EventResponse updateEvent(@PathVariable UUID eventId, @Valid @RequestBody UpdateEventRequest request,
                                     @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        return EventResponse.from(updateEventUseCase.updateEvent(new UpdateEventCommand(
                eventId, request.name(), request.venue(), request.description(), request.bannerUrl(),
                request.startsAt(), request.endsAt(), request.status())));
    }
}
