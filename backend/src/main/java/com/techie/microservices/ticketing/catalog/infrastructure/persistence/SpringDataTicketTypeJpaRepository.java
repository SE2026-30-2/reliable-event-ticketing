package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpringDataTicketTypeJpaRepository extends JpaRepository<TicketTypeEntity, Long> {
    Optional<TicketTypeEntity> findByTicketTypeId(UUID ticketTypeId);

    List<TicketTypeEntity> findByEventId(UUID eventId);

    /**
     * Row-locks (SELECT ... FOR UPDATE, blocking - not SKIP LOCKED) the ticket type for the
     * duration of the caller's transaction. Two concurrent purchases of the last remaining ticket
     * of the same type must serialize here: whichever transaction commits first increments
     * {@code issued_count}, and the second blocks until then and re-reads the now-updated count
     * before its own quota check - this is what prevents overselling a sold-out ticket type.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM TicketTypeEntity t WHERE t.ticketTypeId = :ticketTypeId")
    Optional<TicketTypeEntity> findByTicketTypeIdForUpdate(@Param("ticketTypeId") UUID ticketTypeId);
}
