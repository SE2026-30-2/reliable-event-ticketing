package com.ticketing.platform.shared.infrastructure.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.platform.shared.application.port.OutboxEventPublisherPort;
import com.ticketing.platform.shared.domain.event.OutboxEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Implements {@link OutboxEventPublisherPort} by INSERTing a row into {@code outbox_events} -
 * this class never talks to Kafka. Publishing the row to Kafka is a separate concern, handled by
 * {@code OutboxRelayPublisher}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxEventPublisherAdapter implements OutboxEventPublisherPort {

    private final SpringDataOutboxEventJpaRepository outboxEventJpaRepository;
    private final ObjectMapper objectMapper;

    @Override
    public void publish(String aggregateId, String eventType, String topic, Object payload) {
        UUID eventId = payload instanceof OutboxEvent outboxEvent ? outboxEvent.eventId() : UUID.randomUUID();

        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(
                    "Failed to serialize outbox payload for aggregate " + aggregateId + ", eventType " + eventType, e);
        }

        OutboxEventEntity entity = OutboxEventEntity.builder()
                .eventId(eventId)
                .aggregateId(aggregateId)
                .eventType(eventType)
                .topic(topic)
                .payload(json)
                .createdAt(Instant.now())
                .build();

        outboxEventJpaRepository.save(entity);
        log.info("Outbox event {} written - type={}, aggregateId={}, topic={}", eventId, eventType, aggregateId, topic);
    }
}
