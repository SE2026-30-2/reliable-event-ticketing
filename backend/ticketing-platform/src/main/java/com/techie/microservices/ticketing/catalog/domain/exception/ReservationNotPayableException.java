package com.techie.microservices.ticketing.catalog.domain.exception;

import java.util.UUID;

/** The reservation exists but can no longer be paid for: already issued/cancelled, or its hold
 * window has lapsed (even if ExpireReservationsJob has not swept it yet). */
public class ReservationNotPayableException extends RuntimeException {
    public ReservationNotPayableException(UUID reservationId, String reason) {
        super("Reservation " + reservationId + " cannot be paid: " + reason);
    }
}
