package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.Event;

import java.util.UUID;

public interface GetEventUseCase {
    Event getEvent(UUID eventId);
}
