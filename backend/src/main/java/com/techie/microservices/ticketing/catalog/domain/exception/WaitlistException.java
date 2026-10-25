package com.techie.microservices.ticketing.catalog.domain.exception;

public class WaitlistException extends RuntimeException {
    public WaitlistException(String message) {
        super(message);
    }
}
