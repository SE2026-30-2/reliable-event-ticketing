package com.ticketing.payment.application.port;

/** A provider status query failed before it could return an authoritative transaction result. */
public class ProviderQueryException extends RuntimeException {

    public ProviderQueryException(String message) {
        super(message);
    }

    public ProviderQueryException(String message, Throwable cause) {
        super(message, cause);
    }
}
