package com.techie.microservices.user.infrastructure.persistence;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SpringDataOutboxEventJpaRepository extends JpaRepository<OutboxEventEntity, Long> {

    /**
     * {@code FOR UPDATE SKIP LOCKED}: if this service is ever scaled to more than one instance,
     * each instance's poll must not select a row another instance already has locked. Mirrors
     * payment-service's own query of the same shape.
     */
    @Query(value = "SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY id LIMIT :limit FOR UPDATE SKIP LOCKED",
            nativeQuery = true)
    List<OutboxEventEntity> findPendingForRelay(@Param("limit") int limit);
}
