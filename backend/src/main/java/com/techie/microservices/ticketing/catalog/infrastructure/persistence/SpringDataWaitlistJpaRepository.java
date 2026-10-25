package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpringDataWaitlistJpaRepository extends JpaRepository<WaitlistEntryEntity, Long> {
    Optional<WaitlistEntryEntity> findByEntryId(UUID entryId);

    /** SKIP LOCKED: two app instances never both promote the same entry. Native because JPQL cannot express it. */
    @Query(value = "SELECT * FROM waitlist_entries WHERE entry_id = :entryId FOR UPDATE SKIP LOCKED", nativeQuery = true)
    Optional<WaitlistEntryEntity> findByEntryIdForUpdateSkipLocked(@Param("entryId") UUID entryId);

    @Query("SELECT w FROM WaitlistEntryEntity w WHERE w.ticketTypeId = :typeId AND w.ownerEmail = :owner AND w.status IN ('WAITING', 'OFFERED')")
    Optional<WaitlistEntryEntity> findActive(@Param("typeId") UUID ticketTypeId, @Param("owner") String ownerEmail);

    @Query("SELECT COUNT(w) FROM WaitlistEntryEntity w WHERE w.ownerEmail = :owner AND w.status IN ('WAITING', 'OFFERED')")
    long countActiveByOwner(@Param("owner") String ownerEmail);

    @Query("SELECT COALESCE(SUM(w.quantity), 0) FROM WaitlistEntryEntity w WHERE w.ticketTypeId = :typeId AND w.status = 'WAITING'")
    long sumWaitingQuantity(@Param("typeId") UUID ticketTypeId);

    @Query("SELECT COALESCE(SUM(w.quantity), 0) FROM WaitlistEntryEntity w WHERE w.ticketTypeId = :typeId AND w.status = 'WAITING' AND w.quantity <= :maxUnits")
    long sumWaitingQuantityFitting(@Param("typeId") UUID ticketTypeId, @Param("maxUnits") int maxUnits);

    List<WaitlistEntryEntity> findByTicketTypeIdAndStatusOrderByCreatedAtAsc(UUID ticketTypeId, String status);

    @Query("SELECT DISTINCT w.ticketTypeId FROM WaitlistEntryEntity w WHERE w.status = 'WAITING'")
    List<UUID> findTicketTypeIdsWithWaiting();

    List<WaitlistEntryEntity> findByStatus(String status);

    List<WaitlistEntryEntity> findByOwnerEmailOrderByCreatedAtDesc(String ownerEmail, Pageable pageable);
}
