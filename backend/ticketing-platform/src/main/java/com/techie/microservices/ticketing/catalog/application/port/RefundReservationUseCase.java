package com.techie.microservices.ticketing.catalog.application.port;

import java.util.UUID;

public interface RefundReservationUseCase {
    /** Marks every ISSUED ticket of the reservation REFUNDED (and announces each on ticket-voided
     * so check-in rejects it). Idempotent: tickets already past ISSUED are left alone. */
    void refundReservation(UUID reservationId);
}
