package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.shared.domain.Actor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventAccessApplicationServiceTest {

    @Mock
    private EventRepositoryPort events;

    private final UUID eventId = UUID.randomUUID();

    private EventAccessApplicationService service() {
        return new EventAccessApplicationService(events);
    }

    private void eventOwnedBy(String organizerId) {
        when(events.findByEventId(eventId)).thenReturn(Optional.of(Event.builder().eventId(eventId).organizerId(organizerId).build()));
    }

    @Test
    void adminManagesEverythingIncludingEventsWithNoOrganizer() {
        eventOwnedBy(null);
        assertThat(service().canManage(eventId, new Actor("root@x.com", true, false))).isTrue();
    }

    @Test
    void organizerManagesOnlyTheirOwnEventsCaseInsensitively() {
        eventOwnedBy("org@x.com");
        assertThat(service().canManage(eventId, new Actor("ORG@x.com", false, true))).isTrue();
        assertThat(service().canManage(eventId, new Actor("other@x.com", false, true))).isFalse();
    }

    @Test
    void anOrganizerCannotManageLegacyEventsWithoutAnOrganizer() {
        eventOwnedBy(null);
        assertThat(service().canManage(eventId, new Actor("org@x.com", false, true))).isFalse();
    }

    @Test
    void aPlainBuyerOrAnonymousCallerManagesNothing() {
        eventOwnedBy("buyer@x.com");
        assertThat(service().canManage(eventId, new Actor("buyer@x.com", false, false))).isFalse();
        assertThat(service().canManage(eventId, null)).isFalse();
    }

    @Test
    void assertLooksLikeNotFoundForMissingAndForForbiddenAlike() {
        when(events.findByEventId(eventId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().assertCanManage(eventId, new Actor("a@x.com", true, false)))
                .isInstanceOf(EventNotFoundException.class);
        eventOwnedBy("org@x.com");
        assertThatThrownBy(() -> service().assertCanManage(eventId, new Actor("other@x.com", false, true)))
                .isInstanceOf(EventNotFoundException.class);
    }
}
