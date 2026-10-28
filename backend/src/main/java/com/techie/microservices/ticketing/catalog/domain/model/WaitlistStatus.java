package com.techie.microservices.ticketing.catalog.domain.model;

public enum WaitlistStatus {
    /** In line. */
    WAITING,
    /** Given a time-limited reservation; the buyer is expected to pay. */
    OFFERED,
    /** The offered reservation was paid. */
    CONVERTED,
    /** The offer lapsed unpaid, or could not be made. */
    EXPIRED,
    /** The buyer left the list. */
    CANCELLED
}
