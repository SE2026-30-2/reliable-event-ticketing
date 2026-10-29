package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Event;

import java.util.UUID;

public interface GetEventUseCase {
    Event getEvent(UUID eventId);
}
