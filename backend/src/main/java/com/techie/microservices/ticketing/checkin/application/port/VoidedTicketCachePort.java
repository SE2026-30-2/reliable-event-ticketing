package com.techie.microservices.ticketing.checkin.application.port;

import java.time.Instant;
import java.util.UUID;

/** Local read model of catalog's {@code ticket-voided} events - lets check-in submission reject a
 * voided/refunded ticket without a synchronous call back to the catalog module. */
public interface VoidedTicketCachePort {
    void upsert(UUID ticketId, String reason, Instant voidedAt);

    boolean isVoided(UUID ticketId);
}
