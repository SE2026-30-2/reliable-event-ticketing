package com.techie.microservices.ticketing.shared.domain.event;

import java.util.UUID;

/**
 * Marker interface implemented by every event payload written to the outbox
 * ({@code OutboxEventPublisherPort#publish}). {@link #eventId()} is the same UUID stored in the
 * {@code outbox_events.event_id} column and echoed in the event's own JSON body - consumers
 * (checkin-service, notification-service) use it for idempotent processing (see their own
 * {@code processed_events} tables).
 */
public interface OutboxEvent {

    UUID eventId();
}
