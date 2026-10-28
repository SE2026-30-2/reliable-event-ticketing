package com.techie.microservices.ticketing.catalog.application.port;

public interface CancelReservationUseCase {
    /** Idempotent, same reasoning as {@link ConfirmReservationUseCase}. Used both for an explicit
     * payment-failed event and for {@code ExpireReservationsJob}'s timeout sweep - the same
     * outcome (release held quota, mark CANCELLED), just a different trigger and reason string. */
    void cancelReservation(CancelReservationCommand command);
}
