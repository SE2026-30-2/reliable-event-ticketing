package com.ticketing.identity.infrastructure.messaging;

import com.ticketing.identity.infrastructure.persistence.OutboxEventEntity;
import com.ticketing.identity.infrastructure.persistence.SpringDataOutboxEventJpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Outbox relay: polls {@code outbox_events} for rows that have not been published yet and sends
 * each one to Kafka, marking it published on success. Running this on a schedule (rather than
 * publishing to Kafka directly from the request thread) is what makes the DB write and the Kafka
 * publish effectively atomic without a distributed transaction - if the process crashes after the
 * DB commit but before the Kafka send, the row is simply still unpublished and gets picked up on
 * the next poll. Mirrors payment-service's relay of the same name/shape.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxRelayPublisher {

    private static final long SEND_TIMEOUT_SECONDS = 5L;
    private static final int RELAY_BATCH_SIZE = 100;

    private final SpringDataOutboxEventJpaRepository outboxEventJpaRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Scheduled(fixedDelay = 2000)
    @Transactional
    public void publishPendingEvents() {
        List<OutboxEventEntity> pending = outboxEventJpaRepository.findPendingForRelay(RELAY_BATCH_SIZE);
        for (OutboxEventEntity event : pending) {
            try {
                kafkaTemplate.send(event.getTopic(), event.getAggregateId(), event.getPayload())
                        .get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
                event.setPublishedAt(Instant.now());
                outboxEventJpaRepository.save(event);
                log.info("Published outbox event eventId={} topic={} aggregateId={}",
                        event.getEventId(), event.getTopic(), event.getAggregateId());
            } catch (Exception e) {
                log.error("Failed to publish outbox event eventId={} topic={} - will retry on next poll",
                        event.getEventId(), event.getTopic(), e);
            }
        }
    }
}
