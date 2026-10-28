package com.ticketing.platform.notification.domain.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Consumed from user-service's {@code password-reset-requested} topic - see
 * {@link EmailVerificationRequestedEvent}'s Javadoc for the shared-shape-not-shared-class
 * rationale. */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class PasswordResetRequestedEvent {
    private String eventId;
    private String email;
    private String fullName;
    private String token;
}
