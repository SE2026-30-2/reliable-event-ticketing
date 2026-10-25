package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Event;

public interface CreateEventUseCase {
    Event createEvent(CreateEventCommand command);
}
