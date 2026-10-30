package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpringDataTicketJpaRepository extends JpaRepository<TicketEntity, Long> {
    Optional<TicketEntity> findByTicketId(UUID ticketId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM TicketEntity t WHERE t.ticketId = :ticketId")
    Optional<TicketEntity> findByTicketIdForUpdate(@Param("ticketId") UUID ticketId);

    Page<TicketEntity> findByEventId(UUID eventId, Pageable pageable);

    List<TicketEntity> findByReservationId(UUID reservationId);

    long countByOwnerEmailIgnoreCaseAndStatus(String ownerEmail, String status);

    Page<TicketEntity> findByOwnerEmailIgnoreCase(String ownerEmail, Pageable pageable);

    long countByEventIdAndStatus(UUID eventId, String status);

    List<TicketEntity> findByStatusAndReservationExpiresAtBefore(String status, Instant before);
}
