package com.ticketing.platform.catalog.infrastructure.persistence;

import com.ticketing.platform.catalog.domain.exception.EventNotFoundException;
import com.ticketing.platform.shared.domain.Actor;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EventAccessAdapterTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final EventAccessAdapter adapter = new EventAccessAdapter(jdbcTemplate);
    private final UUID eventId = UUID.randomUUID();

    @Test
    void allowsAdminToManageAnExistingEvent() {
        mockOrganizer("organizer@example.com");

        assertThat(adapter.canManage(eventId, new Actor("admin@example.com", true, false))).isTrue();
    }

    @Test
    void allowsOwningOrganizerIgnoringEmailCase() {
        mockOrganizer("organizer@example.com");

        assertThat(adapter.canManage(eventId, new Actor("Organizer@Example.com", false, true))).isTrue();
    }

    @Test
    void deniesOtherOrganizersAndMissingEvents() {
        mockOrganizer("organizer@example.com");
        assertThat(adapter.canManage(eventId, new Actor("other@example.com", false, true))).isFalse();

        when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq(eventId))).thenReturn(List.of());
        assertThat(adapter.canManage(eventId, new Actor("admin@example.com", true, false))).isFalse();
    }

    @Test
    void hidesMissingOrUnauthorizedEventsFromManagementCallers() {
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq(eventId)))
                .thenReturn(Collections.singletonList("organizer@example.com"));

        assertThatThrownBy(() -> adapter.assertCanManage(eventId, new Actor("other@example.com", false, true)))
                .isInstanceOf(EventNotFoundException.class);
    }

    private void mockOrganizer(String organizerId) {
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq(eventId))).thenReturn(List.of(organizerId));
    }
}
