package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.WaitlistEntry;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WaitlistRepositoryPort {
    WaitlistEntry save(WaitlistEntry entry);

    Optional<WaitlistEntry> findByEntryId(UUID entryId);

    /** Row-locked, skipping rows another instance is already working on. */
    Optional<WaitlistEntry> findByEntryIdForUpdateSkipLocked(UUID entryId);

    Optional<WaitlistEntry> findActive(UUID ticketTypeId, String ownerEmail);

    long countActiveByOwner(String ownerEmail);

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
