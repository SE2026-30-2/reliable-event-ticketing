package com.ticketing.platform.catalog.infrastructure.persistence;

import com.ticketing.platform.catalog.domain.exception.EventNotFoundException;
import com.ticketing.platform.shared.application.port.EventAccessPort;
import com.ticketing.platform.shared.domain.Actor;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EventAccessAdapter implements EventAccessPort {

    private static final String FIND_ORGANIZER_SQL = "SELECT organizer_id FROM events WHERE event_id = ?";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public boolean canManage(UUID eventId, Actor actor) {
        if (actor == null || eventId == null) {
            return false;
        }

        List<String> organizerIds = jdbcTemplate.queryForList(FIND_ORGANIZER_SQL, String.class, eventId);
        if (organizerIds.isEmpty()) {
            return false;
        }

        String organizerId = organizerIds.get(0);
        return actor.admin()
                || (actor.organizer() && organizerId != null && organizerId.equalsIgnoreCase(actor.email()));
    }

    @Override
    public void assertCanManage(UUID eventId, Actor actor) {
        if (!canManage(eventId, actor)) {
            throw new EventNotFoundException(eventId);
        }
    }
}
