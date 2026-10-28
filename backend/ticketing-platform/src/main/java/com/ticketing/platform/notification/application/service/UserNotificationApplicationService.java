package com.ticketing.platform.notification.application.service;

import com.ticketing.platform.notification.application.port.EmailSenderPort;
import com.ticketing.platform.notification.application.port.SendUserNotificationUseCase;
import com.ticketing.platform.notification.domain.event.EmailVerificationRequestedEvent;
import com.ticketing.platform.notification.domain.event.PasswordResetRequestedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** Ported unchanged from notification-service - user-service's account-lifecycle events are
 * untouched by the e-commerce->ticketing pivot. */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserNotificationApplicationService implements SendUserNotificationUseCase {

    private final EmailSenderPort emailSenderPort;

    @Value("${notification.mail.verification.subject}")
    private String verificationSubject;

    @Value("${notification.mail.verification.body-template}")
    private String verificationBodyTemplate;

    @Value("${notification.mail.verification.link-template}")
    private String verificationLinkTemplate;

    @Value("${notification.mail.password-reset.subject}")
    private String passwordResetSubject;

    @Value("${notification.mail.password-reset.body-template}")
    private String passwordResetBodyTemplate;

    @Value("${notification.mail.password-reset.link-template}")
    private String passwordResetLinkTemplate;

    @Override
    public void handleEmailVerificationRequested(EmailVerificationRequestedEvent event) {
        if (event == null || !StringUtils.hasText(event.getEmail()) || !StringUtils.hasText(event.getToken())) {
            throw new IllegalArgumentException(
                    "Cannot process email-verification-requested notification: email or token is missing or blank. event=" + event);
        }

        String link = String.format(verificationLinkTemplate, event.getToken());
        String body = String.format(verificationBodyTemplate, nameOrFallback(event.getFullName()), link);

        try {
            emailSenderPort.send(event.getEmail(), verificationSubject, body);
            log.info("Email verification link sent. eventId={}, email={}", event.getEventId(), event.getEmail());
        } catch (Exception e) {
            log.error("Failed to send email verification link. eventId={}, email={}, reason={}",
                    event.getEventId(), event.getEmail(), e.getMessage(), e);
        }
    }

    @Override
    public void handlePasswordResetRequested(PasswordResetRequestedEvent event) {
        if (event == null || !StringUtils.hasText(event.getEmail()) || !StringUtils.hasText(event.getToken())) {
            throw new IllegalArgumentException(
                    "Cannot process password-reset-requested notification: email or token is missing or blank. event=" + event);
        }

        String link = String.format(passwordResetLinkTemplate, event.getToken());
        String body = String.format(passwordResetBodyTemplate, nameOrFallback(event.getFullName()), link);

        try {
            emailSenderPort.send(event.getEmail(), passwordResetSubject, body);
            log.info("Password reset link sent. eventId={}, email={}", event.getEventId(), event.getEmail());
        } catch (Exception e) {
            log.error("Failed to send password reset link. eventId={}, email={}, reason={}",
                    event.getEventId(), event.getEmail(), e.getMessage(), e);
        }
    }

    private static String nameOrFallback(String fullName) {
        return StringUtils.hasText(fullName) ? fullName : "there";
    }
}
