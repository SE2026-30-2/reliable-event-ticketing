package com.techie.microservices.ticketing.shared.infrastructure.messaging;

import com.techie.microservices.ticketing.shared.infrastructure.persistence.SpringDataOutboxEventJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Every domain change writes an outbox row, and without this the table only ever grows. Rows that
 * were successfully relayed to Kafka are kept for a retention window (useful when investigating
 * "did this event go out?") and then deleted; rows still unpublished are never touched.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxCleanupJob {

    private final SpringDataOutboxEventJpaRepository outboxRepository;

    @Value("${ticketing.outbox.retention-days:7}")
    private long retentionDays;

    @Scheduled(fixedDelayString = "${ticketing.outbox.cleanup-interval-ms:3600000}", initialDelay = 60_000)
    @Transactional
    public int deleteOldPublishedEvents() {
        int deleted = outboxRepository.deletePublishedBefore(Instant.now().minus(Duration.ofDays(retentionDays)));
        if (deleted > 0) {
            log.info("Outbox cleanup removed {} published event(s) older than {} day(s)", deleted, retentionDays);
        }
        return deleted;
    }
}
