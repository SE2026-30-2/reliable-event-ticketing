package com.ticketing.platform.notification.infrastructure.messaging;

import com.ticketing.platform.notification.application.port.SendTicketNotificationUseCase;
import com.ticketing.platform.notification.infrastructure.messaging.dto.TicketIssuedEvent;
import com.ticketing.platform.notification.infrastructure.messaging.dto.TicketResendRequestedEvent;
import com.ticketing.platform.notification.infrastructure.messaging.dto.TicketVoidedEvent;
import com.ticketing.platform.notification.infrastructure.messaging.dto.WaitlistOfferedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Replaces the old e-commerce {@code OrderSagaEventListener} - consumes catalog's outbox events
 * instead of order-service's. */
@Component
@RequiredArgsConstructor
@Slf4j
public class TicketEventListener {

    private final SendTicketNotificationUseCase sendTicketNotificationUseCase;

    @KafkaListener(topics = "${kafka.topic.ticket-issued}", groupId = "ticketing-platform-notification")
    public void onTicketIssued(TicketIssuedEvent event) {
        log.info("Got message from ticket-issued topic: ticketId={}, email={}", event.ticketId(), event.holderEmail());
        sendTicketNotificationUseCase.handleTicketIssued(event);
    }

    @KafkaListener(topics = "${kafka.topic.ticket-voided}", groupId = "ticketing-platform-notification")
    public void onTicketVoided(TicketVoidedEvent event) {
        log.info("Got message from ticket-voided topic: ticketId={}, status={}", event.ticketId(), event.status());
        sendTicketNotificationUseCase.handleTicketVoided(event);
    }

    /** Someone waiting for tickets was given a time-limited hold - tell them to pay. */
    @KafkaListener(topics = "${kafka.topic.waitlist-offered}", groupId = "ticketing-platform-notification")
    public void onWaitlistOffered(WaitlistOfferedEvent event) {
        log.info("Got message from waitlist-offered topic: entryId={}", event.entryId());
        sendTicketNotificationUseCase.handleWaitlistOffered(event);
    }

    /** A buyer asked for their ticket email again - the email is identical to the original. */
    @KafkaListener(topics = "${kafka.topic.ticket-resend-requested}", groupId = "ticketing-platform-notification")
    public void onTicketResendRequested(TicketResendRequestedEvent event) {
        log.info("Got message from ticket-resend-requested topic: ticketId={}", event.ticketId());
        sendTicketNotificationUseCase.handleTicketIssued(event.asIssuedEvent());
    }
}
