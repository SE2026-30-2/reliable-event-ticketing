package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.CreateEventCommand;
import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.UpdateEventCommand;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidEventChangeException;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import com.techie.microservices.ticketing.shared.domain.Actor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventApplicationServiceTest {

    @Mock
    private EventRepositoryPort events;

    private EventApplicationService service;
    private final Instant start = Instant.now().plusSeconds(3600);
    private final Instant end = start.plusSeconds(3600);

    @BeforeEach
    void setUp() {
        service = new EventApplicationService(events);
    }

    private Event existing(EventStatus status) {
        Event e = Event.builder().eventId(UUID.randomUUID()).name("Old").startsAt(start).endsAt(end).status(status).build();
        when(events.findByEventId(e.getEventId())).thenReturn(Optional.of(e));
        org.mockito.Mockito.lenient().when(events.save(any(Event.class))).thenAnswer(inv -> inv.getArgument(0));
        return e;
    }

    @Test
    void createDefaultsToPublishedAndRecordsTheOrganizerLowerCased() {
        when(events.save(any(Event.class))).thenAnswer(inv -> inv.getArgument(0));
        Event e = service.createEvent(new CreateEventCommand("Gig", "Hall", start, end, " Org@X.com ", "d", null, null));
        assertThat(e.getStatus()).isEqualTo(EventStatus.PUBLISHED);
        assertThat(e.getOrganizerId()).isEqualTo("org@x.com");
    }

    @Test
    void createRejectsTerminalStatusesAndBackwardsTimes() {
        assertThatThrownBy(() -> service.createEvent(new CreateEventCommand("G", null, start, end, "o@x.com", null, null, EventStatus.CANCELLED)))
                .isInstanceOf(InvalidEventChangeException.class);
        assertThatThrownBy(() -> service.createEvent(new CreateEventCommand("G", null, end, start, "o@x.com", null, null, null)))
                .isInstanceOf(InvalidEventChangeException.class);
    }

    @Test
    void draftCanBePublishedAndPublishedCanBeCancelledButNotBack() {
        Event draft = existing(EventStatus.DRAFT);
        assertThat(service.updateEvent(new UpdateEventCommand(draft.getEventId(), null, null, null, null, null, null, EventStatus.PUBLISHED)).getStatus())
                .isEqualTo(EventStatus.PUBLISHED);
        assertThat(service.updateEvent(new UpdateEventCommand(draft.getEventId(), null, null, null, null, null, null, EventStatus.CANCELLED)).getStatus())
                .isEqualTo(EventStatus.CANCELLED);
        assertThatThrownBy(() -> service.updateEvent(new UpdateEventCommand(draft.getEventId(), null, null, null, null, null, null, EventStatus.PUBLISHED)))
                .isInstanceOf(InvalidEventChangeException.class); // CANCELLED is final
    }

    @Test
    void aPublishedEventCannotGoBackToDraft() {
        Event pub = existing(EventStatus.PUBLISHED);
        assertThatThrownBy(() -> service.updateEvent(new UpdateEventCommand(pub.getEventId(), null, null, null, null, null, null, EventStatus.DRAFT)))
                .isInstanceOf(InvalidEventChangeException.class);
    }

    @Test
    void updateChangesOnlyTheFieldsSentAndValidatesTheTimeRange() {
        Event e = existing(EventStatus.PUBLISHED);
        Event updated = service.updateEvent(new UpdateEventCommand(e.getEventId(), "New", null, null, null, null, null, null));
        assertThat(updated.getName()).isEqualTo("New");
        assertThat(updated.getStartsAt()).isEqualTo(start);
        assertThatThrownBy(() -> service.updateEvent(new UpdateEventCommand(e.getEventId(), null, null, null, null, end.plusSeconds(5), null, null)))
                .isInstanceOf(InvalidEventChangeException.class);
    }

    @Test
    void organizerListsOwnEventsAdminListsAll() {
        service.listManageableEvents(new Actor("org@x.com", false, true));
        verify(events).findByOrganizer("org@x.com");
        when(events.findAll()).thenReturn(List.of());
        service.listManageableEvents(new Actor("root@x.com", true, false));
        verify(events).findAll();
    }
}
