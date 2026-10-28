package com.ticketing.platform.notification.application.port;

import com.ticketing.platform.notification.domain.event.EmailVerificationRequestedEvent;
import com.ticketing.platform.notification.domain.event.PasswordResetRequestedEvent;

/** Handles user-service's two account-lifecycle requests by emailing the user a link built
 * around the event's raw token. */
public interface SendUserNotificationUseCase {
    void handleEmailVerificationRequested(EmailVerificationRequestedEvent event);

    void handlePasswordResetRequested(PasswordResetRequestedEvent event);
}
