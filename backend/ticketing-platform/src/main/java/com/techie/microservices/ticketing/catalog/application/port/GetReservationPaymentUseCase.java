package com.techie.microservices.ticketing.catalog.application.port;

import java.util.UUID;

public interface GetReservationPaymentUseCase {
    /** @throws com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotFoundException unknown id, or not the requester's
     *  @throws com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotPayableException not RESERVED, or expired */
    ReservationPayment getPayableReservation(UUID reservationId, String requesterEmail);

    /** Ownership check alone (for an already-paid reservation being queried again). A reservation
     * that exists but belongs to someone else is reported as not found, never as forbidden. */
    void assertReservationOwnedBy(UUID reservationId, String requesterEmail);

    /** Whether the reservation can still be honoured right now (has RESERVED tickets, not expired) -
     * no ownership check: for the payment module's own bookkeeping, never for a caller-facing answer. */
    boolean isPayable(UUID reservationId);
}
