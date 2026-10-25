package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.shared.domain.Actor;

import java.util.List;

public interface ListEventsUseCase {
    /** Every event, any status - internal use. */
    List<Event> listEvents();

    /** What the public may see: PUBLISHED and not yet ended, optionally filtered by name/venue. */
    List<Event> listPublicEvents(String query);

    /** The events this actor manages: all for ADMIN, own for ORGANIZER. */
    List<Event> listManageableEvents(Actor actor);
}
