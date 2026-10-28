package com.techie.microservices.ticketing.catalog.application.port;

import java.time.Instant;
import java.util.UUID;

/** What a buyer owes for a still-payable reservation, computed from the ticket type's price -
 * never from anything the client sent - and the moment the hold lapses (a hosted payment page
 * must not outlive it). */
public record ReservationPayment(UUID reservationId, long amountCents, int ticketCount, Instant expiresAt) {
}
