package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpringDataEventJpaRepository extends JpaRepository<EventEntity, Long> {
    Optional<EventEntity> findByEventId(UUID eventId);

    List<EventEntity> findByOrganizerIdOrderByStartsAtDesc(String organizerId);

    @Query("""
            SELECT e FROM EventEntity e
            WHERE e.status = 'PUBLISHED' AND e.endsAt > :now
              AND (LOWER(e.name) LIKE :q ESCAPE '\\' OR LOWER(COALESCE(e.venue, '')) LIKE :q ESCAPE '\\')
            ORDER BY e.startsAt ASC
            """)
    List<EventEntity> searchPublic(@Param("now") Instant now, @Param("q") String like, Pageable pageable);
}
