package com.techie.microservices.ticketing.catalog.domain.exception;

public class TooManyActiveReservationsException extends RuntimeException {
    public TooManyActiveReservationsException(int limit) {
        super("Too many unpaid reservations for this email (limit " + limit
                + "); pay for or wait out your existing reservations first");
    }
}
