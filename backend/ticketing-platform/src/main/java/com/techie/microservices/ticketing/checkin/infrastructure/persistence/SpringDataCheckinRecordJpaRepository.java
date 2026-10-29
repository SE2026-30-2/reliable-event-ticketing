package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SpringDataCheckinRecordJpaRepository extends JpaRepository<CheckinRecordEntity, Long> {
    Optional<CheckinRecordEntity> findByIdempotencyKey(UUID idempotencyKey);

    long countByEventIdAndOutcome(UUID eventId, String outcome);
}
