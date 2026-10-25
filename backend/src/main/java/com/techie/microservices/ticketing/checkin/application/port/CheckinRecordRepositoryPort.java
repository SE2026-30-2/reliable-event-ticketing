package com.techie.microservices.ticketing.checkin.application.port;

import com.techie.microservices.ticketing.checkin.domain.model.CheckinOutcome;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinRecord;

import java.util.Optional;
import java.util.UUID;

public interface CheckinRecordRepositoryPort {
    Optional<CheckinRecord> findByIdempotencyKey(UUID idempotencyKey);

    /** Plain insert - used for every outcome except a first-time ACCEPTED, where the race against
     * concurrent submissions of the same ticket matters (see {@link #tryAccept}). */
    CheckinRecord save(CheckinRecord record);

    /**
     * Records an ACCEPTED check-in for {@code record.getTicketId()} as its next entry (sets
     * {@code record.entryNo}), unless the ticket's {@code maxEntries} are used up or it was voided.
     * <p>
     * Serialised per ticket with a transaction-scoped advisory lock, so "count the entries so far"
     * and "insert the next one" are one atomic step and a void/transfer taking the same lock either
     * fully precedes or fully follows it - the first committer wins, never a client clock. The DB's
     * unique index on {@code (ticket_id, entry_no) WHERE outcome = 'ACCEPTED'} backstops the logic.
     * Runs in its own transaction so a conflict here never poisons the caller's.
     */
    AcceptResult tryAccept(CheckinRecord record, int maxEntries);

    long countByEventIdAndOutcome(UUID eventId, CheckinOutcome outcome);
}
