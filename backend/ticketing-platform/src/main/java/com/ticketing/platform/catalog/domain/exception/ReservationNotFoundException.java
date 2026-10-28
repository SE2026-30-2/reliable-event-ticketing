package com.ticketing.platform.catalog.domain.exception;

import java.util.UUID;

public class ReservationNotFoundException extends RuntimeException {
    public ReservationNotFoundException(UUID reservationId) {
        super("Reservation " + reservationId + " not found");
    }
}
