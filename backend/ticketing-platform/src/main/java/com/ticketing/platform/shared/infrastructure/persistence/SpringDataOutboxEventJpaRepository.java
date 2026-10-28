package com.ticketing.platform.shared.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface SpringDataOutboxEventJpaRepository extends JpaRepository<OutboxEventEntity, Long> {

    /**
     * {@code FOR UPDATE SKIP LOCKED}: if this service is ever scaled to more than one instance,
     * each instance's poll must not select a row another instance already has locked. Native query
     * since standard JPA {@code @Lock} has no portable SKIP LOCKED support; safe only inside the
     * caller's existing {@code @Transactional} boundary, which is what holds the row locks until
     * commit. Same pattern as order-service's own outbox relay.
     */
    @Query(value = "SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY id LIMIT :limit FOR UPDATE SKIP LOCKED",
            nativeQuery = true)
    List<OutboxEventEntity> findPendingForRelay(@Param("limit") int limit);

    /** Only ever deletes rows already relayed to Kafka - an unpublished row is an undelivered event. */
    @Modifying
    @Query("DELETE FROM OutboxEventEntity e WHERE e.publishedAt IS NOT NULL AND e.publishedAt < :before")
    int deletePublishedBefore(@Param("before") Instant before);
}
