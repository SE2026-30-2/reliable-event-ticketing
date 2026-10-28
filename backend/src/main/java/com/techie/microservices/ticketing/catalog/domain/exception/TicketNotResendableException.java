package com.techie.microservices.ticketing.catalog.domain.exception;

import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;

import java.util.UUID;

public class TicketNotResendableException extends RuntimeException {
    public TicketNotResendableException(UUID ticketId, TicketStatus status) {
        super("Ticket " + ticketId + " is " + status + " - only ISSUED tickets can be resent");
    }
}
