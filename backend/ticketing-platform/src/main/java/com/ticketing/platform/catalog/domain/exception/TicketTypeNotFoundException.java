package com.ticketing.platform.catalog.domain.exception;

import java.util.UUID;

public class TicketTypeNotFoundException extends RuntimeException {
    public TicketTypeNotFoundException(UUID ticketTypeId) {
        super("Ticket type not found: " + ticketTypeId);
    }
}
