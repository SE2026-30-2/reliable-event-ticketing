package com.techie.microservices.ticketing.catalog.domain.exception;

import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;

import java.util.UUID;

public class InvalidTicketStatusTransitionException extends RuntimeException {
    public InvalidTicketStatusTransitionException(UUID ticketId, TicketStatus current, TicketStatus requested) {
        super("Ticket " + ticketId + " cannot transition from " + current + " to " + requested);
    }
}
