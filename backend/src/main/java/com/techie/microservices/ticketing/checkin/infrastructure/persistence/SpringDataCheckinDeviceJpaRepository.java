package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SpringDataCheckinDeviceJpaRepository extends JpaRepository<CheckinDeviceEntity, Long> {
    java.util.List<CheckinDeviceEntity> findByEventIdOrderByCreatedAtDesc(java.util.UUID eventId);

    Optional<CheckinDeviceEntity> findByDeviceId(UUID deviceId);

    Optional<CheckinDeviceEntity> findByApiKeyHash(String apiKeyHash);
}
