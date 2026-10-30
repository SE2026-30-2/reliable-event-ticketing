package com.techie.microservices.user.infrastructure.messaging.dto;

import java.util.UUID;

/**
 * Published to the {@code password-reset-requested} topic on a forgot-password request. {@code
 * token} is the raw (unhashed) single-use token - carried over Kafka to notification-service so
 * it can be mailed to the user; this service itself only ever stores its SHA-256 hash.
 */
public record PasswordResetRequestedEvent(
        UUID eventId,
        String email,
        String fullName,
        String token
) implements OutboxEvent {
}
