package com.ticketing.catalog.domain.exception;

public class InvalidEventChangeException extends RuntimeException {
    public InvalidEventChangeException(String message) {
        super(message);
    }
}
