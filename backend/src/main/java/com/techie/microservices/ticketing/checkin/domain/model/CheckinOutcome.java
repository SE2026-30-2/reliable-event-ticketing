package com.techie.microservices.ticketing.checkin.domain.model;

public enum CheckinOutcome {
    /** First (and only) accepted scan of this ticket - the ticket is now considered used. */
    ACCEPTED,
    /** A ticket that already has an ACCEPTED record - this is the actual anti-replay mechanism. */
    DUPLICATE,
    /** QR payload's signature does not verify against the catalog module's signing key. */
    INVALID_SIGNATURE,
    /** Signature valid, but the submitting device is registered for a different event. */
    WRONG_EVENT,
    /** Signature valid, but now is outside the ticket's baked-in validFrom/validUntil window. */
    EXPIRED_WINDOW,
    /** Signature valid and in-window, but the ticket was voided/refunded after issuance. */
    TICKET_VOIDED,
    /** The submitting device's API key does not match any registered device. */
    DEVICE_NOT_FOUND,
    /** The submitting device exists but has been revoked. */
    DEVICE_REVOKED
}
