package com.techie.microservices.ticketing.notification.infrastructure.messaging;

import com.techie.microservices.ticketing.notification.application.port.SendUserNotificationUseCase;
import com.techie.microservices.ticketing.notification.domain.event.EmailVerificationRequestedEvent;
import com.techie.microservices.ticketing.notification.domain.event.PasswordResetRequestedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Listens on user-service's account-lifecycle topics - unaffected by the e-commerce->ticketing
 * pivot, ported unchanged from notification-service. */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserEventListener {

    private final SendUserNotificationUseCase sendUserNotificationUseCase;

    @KafkaListener(topics = "${kafka.topic.email-verification-requested}", groupId = "ticketing-platform-notification")
    public void onEmailVerificationRequested(EmailVerificationRequestedEvent event) {
        log.info("Got message from email-verification-requested topic: eventId={}, email={}",
                event.getEventId(), event.getEmail());
        sendUserNotificationUseCase.handleEmailVerificationRequested(event);
    }

    @KafkaListener(topics = "${kafka.topic.password-reset-requested}", groupId = "ticketing-platform-notification")
    public void onPasswordResetRequested(PasswordResetRequestedEvent event) {
        log.info("Got message from password-reset-requested topic: eventId={}, email={}",
                event.getEventId(), event.getEmail());
        sendUserNotificationUseCase.handlePasswordResetRequested(event);
    }
}
