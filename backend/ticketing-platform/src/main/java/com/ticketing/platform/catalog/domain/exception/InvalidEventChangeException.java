package com.ticketing.platform.catalog.domain.exception;

public class InvalidEventChangeException extends RuntimeException {
    public InvalidEventChangeException(String message) {
        super(message);
    }
}
