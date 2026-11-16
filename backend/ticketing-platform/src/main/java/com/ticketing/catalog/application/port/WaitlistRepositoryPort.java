package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.WaitlistEntry;
import com.ticketing.catalog.domain.model.WaitlistStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;

public interface WaitlistRepositoryPort {
    WaitlistEntry save(WaitlistEntry entry);

    Optional<WaitlistEntry> findByEntryId(UUID entryId);

    /** Locks the row so undo and waitlist promotion cannot both change the same entry. */
    Optional<WaitlistEntry> findByEntryIdForUpdate(UUID entryId);

    /** Row-locked, skipping rows another instance is already working on. */
    Optional<WaitlistEntry> findByEntryIdForUpdateSkipLocked(UUID entryId);

    Optional<WaitlistEntry> findActive(UUID ticketTypeId, String ownerEmail);

    Optional<WaitlistEntry> findUndoableByTicketTypeAndOwner(UUID ticketTypeId, String ownerEmail, Instant after);

    long countActiveOrUndoableByOwner(String ownerEmail, Instant after);

    /** Total units asked for by everyone still WAITING on this ticket type. */
    long sumWaitingQuantity(UUID ticketTypeId);

    /** Like {@link #sumWaitingQuantity} but only entries small enough to be served from {@code maxUnits} -
     * the ones the waitlist could actually take quota for right now. */
    long sumWaitingQuantityFitting(UUID ticketTypeId, int maxUnits);

    /** WAITING entries of one ticket type, oldest first. */
    List<WaitlistEntry> findWaiting(UUID ticketTypeId);

    List<UUID> findTicketTypeIdsWithWaiting();

    List<WaitlistEntry> findByStatus(WaitlistStatus status);

    List<WaitlistEntry> findByOwner(String ownerEmail, int limit);
}
