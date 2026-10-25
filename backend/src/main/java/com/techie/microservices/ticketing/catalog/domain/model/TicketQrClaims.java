package com.techie.microservices.ticketing.catalog.domain.model;

import java.util.UUID;

/**
 * The decoded claims carried by a ticket's signed QR payload. Deliberately a flat, short-keyed
 * JSON shape (not a full JWT) to keep the scannable QR code's data density down - see
 * {@code infrastructure.security.TicketQrSigner} for the exact wire format:
 * {@code "<kid>.<base64url(json)>.<base64url(signature)>"}.
 * <p>
 * {@code validFromEpochSeconds}/{@code validUntilEpochSeconds} are the server-assigned validity
 * window, fixed at issuance time and baked immutably into the signature - this is what lets a
 * check-in device judge a ticket's validity without ever trusting its own (or the server's, at
 * verification time, beyond "is now within this window") clock relative to the issuer's clock.
 * {@code maxEntries} (claim {@code me}, written only when above 1) is how many scans the ticket allows.
 */
public record TicketQrClaims(
        UUID ticketId,
        UUID eventId,
        UUID ticketTypeId,
        long validFromEpochSeconds,
        long validUntilEpochSeconds,
        long issuedAtEpochSeconds,
        int maxEntries
) {
    public TicketQrClaims(UUID ticketId, UUID eventId, UUID ticketTypeId, long validFrom, long validUntil, long issuedAt) {
        this(ticketId, eventId, ticketTypeId, validFrom, validUntil, issuedAt, 1);
    }
}
