-- Outbox pattern infrastructure (same shape as order-service's V3__add_saga_infrastructure.sql).
-- Written in the SAME local transaction as the domain change that produced the event (ticket
-- issued / ticket voided or refunded). A separate relay poller (OutboxRelayPublisher) publishes
-- rows where published_at IS NULL to Kafka and then stamps published_at - this is what makes
-- "save the ticket" and "emit the event" atomic without a distributed transaction.
CREATE TABLE outbox_events
(
    id           BIGSERIAL PRIMARY KEY,
    event_id     UUID         NOT NULL UNIQUE,
    aggregate_id VARCHAR(255) NOT NULL, -- always ticket_id, for per-ticket Kafka ordering
    event_type   VARCHAR(100) NOT NULL,
    topic        VARCHAR(100) NOT NULL,
    payload      TEXT         NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);

-- Partial index to keep the relay's "SELECT ... WHERE published_at IS NULL ORDER BY id" poll
-- query cheap as the table grows (published rows never match it again).
CREATE INDEX idx_outbox_events_unpublished ON outbox_events (id) WHERE published_at IS NULL;
