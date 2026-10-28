package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.shared.application.port.EventAccessPort;
import com.techie.microservices.ticketing.shared.domain.Actor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EventAccessApplicationService implements EventAccessPort {

    private final EventRepositoryPort eventRepositoryPort;

    @Override
    public boolean canManage(UUID eventId, Actor actor) {
        if (actor == null) {
            return false;
        }
        return eventRepositoryPort.findByEventId(eventId)
                .map(event -> actor.admin()
                        || (actor.organizer() && event.getOrganizerId() != null
                        && event.getOrganizerId().equalsIgnoreCase(actor.email())))
                .orElse(false);
    }

    @Override
    public void assertCanManage(UUID eventId, Actor actor) {
        if (!canManage(eventId, actor)) {
            throw new EventNotFoundException(eventId);
        }
    }
}
