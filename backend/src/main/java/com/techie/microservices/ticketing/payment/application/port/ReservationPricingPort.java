package com.techie.microservices.ticketing.payment.application.port;

import java.time.Instant;
import java.util.UUID;

/** Payment's view of "what does this reservation cost" - implemented by an adapter over catalog,
 * so the amount is always the server's, never the client's. */
public interface ReservationPricingPort {

    record Quote(long amountCents, Instant expiresAt) {
    }

    /** @throws RuntimeException (catalog's ReservationNotFound/NotPayable) if it cannot be paid. */
    Quote quote(UUID reservationId, String requesterEmail);

    /** Fails (as not-found) unless the reservation belongs to {@code requesterEmail}. */
    void assertOwnedBy(UUID reservationId, String requesterEmail);

    /** Whether the reservation's tickets are still held (no ownership check; internal use). */
    boolean isStillHeld(UUID reservationId);
}
