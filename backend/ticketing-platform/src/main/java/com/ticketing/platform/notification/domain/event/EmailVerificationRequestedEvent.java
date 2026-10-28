package com.ticketing.platform.notification.domain.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Consumed from user-service's {@code email-verification-requested} topic - owned by this module
 * (the consumer) rather than copied from user-service's package, same "only the JSON shape is a
 * shared contract" convention used throughout this app. Unaffected by the e-commerce->ticketing
 * pivot since user-service itself did not change.
 * <p>
 * {@code token} is the raw (unhashed) single-use verification token - user-service never persists
 * it in that form, only its hash, so this event is the only place it ever appears.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class EmailVerificationRequestedEvent {
    private String eventId;
    private String email;
    private String fullName;
    private String token;
}
