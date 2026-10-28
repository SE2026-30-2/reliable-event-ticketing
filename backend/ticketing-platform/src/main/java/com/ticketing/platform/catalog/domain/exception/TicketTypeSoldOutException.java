package com.ticketing.platform.catalog.domain.exception;

import java.util.UUID;

public class TicketTypeSoldOutException extends RuntimeException {
    public TicketTypeSoldOutException(UUID ticketTypeId, int requested, int remaining) {
        super("Ticket type " + ticketTypeId + " cannot fulfill a request for " + requested
                + " ticket(s) - only " + remaining + " remaining");
    }
}
