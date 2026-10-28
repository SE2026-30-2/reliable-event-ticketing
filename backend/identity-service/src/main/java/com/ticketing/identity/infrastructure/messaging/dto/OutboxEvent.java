package com.ticketing.identity.infrastructure.messaging.dto;

import java.util.UUID;

/**
 * Marker interface implemented by every event payload written to the outbox
 * ({@code OutboxEventPublisherPort#publish}). {@link #eventId()} is the same UUID stored in the
 * {@code outbox_events.event_id} column and echoed in the event's own JSON body. Mirrors
 * payment-service's own marker interface of the same name/shape.
 */
public interface OutboxEvent {

    UUID eventId();
}
