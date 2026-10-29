package com.techie.microservices.ticketing.catalog.domain.exception;

public class TicketNotTransferableException extends RuntimeException {
    public TicketNotTransferableException(String message) {
        super(message);
    }
}
