package com.ticketing.identity.application.port;

/**
 * Output port for the outbox pattern: writes a row that will later be relayed to Kafka by
 * {@code infrastructure.messaging.OutboxRelayPublisher}. Implementations must NOT talk to Kafka
 * directly - they only persist the outbox row, in whatever local DB transaction the caller is
 * already in. This is what makes "create the account" / "issue the verification token" and
 * "record the event to publish" atomic. Mirrors payment-service's own port of the same name.
 */
public interface OutboxEventPublisherPort {

    /**
     * Writes a new outbox row.
     *
     * @param aggregateId the id of the aggregate the event is about (the user id)
     * @param eventType   a short label for the event (e.g. "email-verification-requested")
     * @param topic       the Kafka topic the relay should publish this row to
     * @param payload     the event body; JSON-serialized as-is when the row is written
     */
    void publish(String aggregateId, String eventType, String topic, Object payload);
}
