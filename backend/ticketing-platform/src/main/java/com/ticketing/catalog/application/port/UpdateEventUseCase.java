package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.Event;

public interface UpdateEventUseCase {
    /** Authorization is the caller's job (EventAccessPort); this enforces only data rules. */
    Event updateEvent(UpdateEventCommand command);
}
