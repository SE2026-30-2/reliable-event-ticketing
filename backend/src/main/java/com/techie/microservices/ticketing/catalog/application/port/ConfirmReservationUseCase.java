package com.techie.microservices.ticketing.catalog.application.port;

public interface ConfirmReservationUseCase {
    /**
     * Idempotent: a reservation whose tickets are no longer RESERVED (already confirmed,
     * cancelled, or unknown) is a silent no-op - callers (the payment-completed Kafka listener)
     * rely on this instead of a separate event-id dedup table.
     */
    void confirmReservation(ConfirmReservationCommand command);
}
