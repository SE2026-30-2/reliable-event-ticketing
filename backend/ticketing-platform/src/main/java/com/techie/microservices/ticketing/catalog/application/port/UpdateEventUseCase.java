package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Event;

public interface UpdateEventUseCase {
    /** Authorization is the caller's job (EventAccessPort); this enforces only data rules. */
    Event updateEvent(UpdateEventCommand command);
}
