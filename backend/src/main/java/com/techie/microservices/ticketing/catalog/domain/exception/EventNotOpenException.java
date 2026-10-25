package com.techie.microservices.ticketing.catalog.domain.exception;

import java.util.UUID;

public class EventNotOpenException extends RuntimeException {
    public EventNotOpenException(UUID eventId) {
        super("Event " + eventId + " is not open for sales (not published, cancelled, or already over)");
    }
}
