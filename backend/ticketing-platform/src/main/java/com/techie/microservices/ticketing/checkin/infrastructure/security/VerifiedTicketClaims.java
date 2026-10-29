package com.techie.microservices.ticketing.checkin.infrastructure.security;

import java.util.UUID;

/** Mirrors catalog's {@code domain.model.TicketQrClaims} - a separate copy by design (only the
 * wire format is the shared contract, see {@code TicketQrVerifier}). */
public record VerifiedTicketClaims(
        UUID ticketId,
        UUID eventId,
        UUID ticketTypeId,
        long validFromEpochSeconds,
        long validUntilEpochSeconds,
        long issuedAtEpochSeconds,
        int maxEntries
) {
    public VerifiedTicketClaims(UUID ticketId, UUID eventId, UUID ticketTypeId, long validFrom, long validUntil, long issuedAt) {
        this(ticketId, eventId, ticketTypeId, validFrom, validUntil, issuedAt, 1);
    }
}
