package com.ticketing.catalog.domain.exception;

import java.util.UUID;

public class EventNotFoundException extends RuntimeException {
    public EventNotFoundException(UUID eventId) {
        super("Event not found: " + eventId);
    }
}
