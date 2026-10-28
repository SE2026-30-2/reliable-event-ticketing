package com.ticketing.platform.shared.infrastructure.messaging;

import com.ticketing.platform.shared.infrastructure.persistence.OutboxEventEntity;
import com.ticketing.platform.shared.infrastructure.persistence.SpringDataOutboxEventJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Relays outbox rows to Kafka. Polls {@code outbox_events} for rows where
 * {@code published_at IS NULL}, publishes each one (topic = the row's topic column, key = the
 * row's aggregate_id, value = the row's already-serialized JSON payload), and stamps
 * {@code published_at} on success. A row that fails to publish is simply left unpublished and
 * retried on the next poll - "at least once" delivery, which is why consumers (checkin-service,
 * notification-service) must dedupe by eventId. Identical pattern to order-service's own
 * OutboxRelayPublisher.
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
    public void relayPendingEvents() {
        List<OutboxEventEntity> pendingEvents = outboxEventJpaRepository.findPendingForRelay(RELAY_BATCH_SIZE);
        if (pendingEvents.isEmpty()) {
            return;
        }

        log.debug("Relaying {} pending outbox event(s) to Kafka", pendingEvents.size());
        for (OutboxEventEntity event : pendingEvents) {
            publish(event);
        }
    }

    private void publish(OutboxEventEntity event) {
        try {
            kafkaTemplate.send(event.getTopic(), event.getAggregateId(), event.getPayload())
                    .get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            event.setPublishedAt(Instant.now());
            outboxEventJpaRepository.save(event);
            log.info("Relayed outbox event {} (type={}) to topic {}", event.getEventId(), event.getEventType(), event.getTopic());
        } catch (Exception e) {
            log.error("Failed to relay outbox event {} (type={}) to topic {} - will retry on next poll",
                    event.getEventId(), event.getEventType(), event.getTopic(), e);
        }
    }
}
