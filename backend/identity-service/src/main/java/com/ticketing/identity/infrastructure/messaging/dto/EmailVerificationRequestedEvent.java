package com.ticketing.identity.infrastructure.messaging.dto;

import java.util.UUID;

/**
 * Published to the {@code email-verification-requested} topic on registration and on a
 * resend-verification request. {@code token} is the raw (unhashed) single-use token - this is the
 * one and only place it ever leaves this service, carried over Kafka to notification-service so
 * it can be mailed to the user; this service itself only ever stores its SHA-256 hash.
 */
public record EmailVerificationRequestedEvent(
        UUID eventId,
        String email,
        String fullName,
        String token
) implements OutboxEvent {
}
