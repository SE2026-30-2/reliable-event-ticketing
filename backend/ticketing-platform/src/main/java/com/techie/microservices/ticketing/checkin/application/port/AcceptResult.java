package com.techie.microservices.ticketing.checkin.application.port;

/** What {@link CheckinRecordRepositoryPort#tryAccept} decided, atomically per ticket. */
public enum AcceptResult {
    /** Recorded as the next entry for this ticket. */
    ACCEPTED,
    /** Every allowed entry has already been used. */
    ALL_ENTRIES_USED,
    /** The ticket was voided/refunded/transferred - possibly a moment ago, after the caller looked. */
    VOIDED
}
