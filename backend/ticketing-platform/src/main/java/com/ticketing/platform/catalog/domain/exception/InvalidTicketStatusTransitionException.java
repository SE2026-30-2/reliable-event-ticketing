package com.ticketing.platform.catalog.domain.exception;

import com.ticketing.platform.catalog.domain.model.TicketStatus;

import java.util.UUID;

public class InvalidTicketStatusTransitionException extends RuntimeException {
    public InvalidTicketStatusTransitionException(UUID ticketId, TicketStatus current, TicketStatus requested) {
        super("Ticket " + ticketId + " cannot transition from " + current + " to " + requested);
    }
}
