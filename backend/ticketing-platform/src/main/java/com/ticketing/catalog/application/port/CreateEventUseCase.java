package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.Event;

public interface CreateEventUseCase {
    Event createEvent(CreateEventCommand command);
}
