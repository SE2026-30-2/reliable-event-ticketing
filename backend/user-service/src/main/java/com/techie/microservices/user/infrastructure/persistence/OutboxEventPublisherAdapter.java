package com.techie.microservices.user.infrastructure.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techie.microservices.user.application.port.OutboxEventPublisherPort;
import com.techie.microservices.user.infrastructure.messaging.dto.OutboxEvent;

import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Implements {@link OutboxEventPublisherPort} by INSERTing a row into {@code outbox_events} -
 * this class never talks to Kafka. Publishing the row to Kafka is a separate concern, handled by
 * {@code infrastructure.messaging.OutboxRelayPublisher}. Mirrors payment-service's adapter of the
 * same name/shape.
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
