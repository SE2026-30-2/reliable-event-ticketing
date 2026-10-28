package com.techie.microservices.ticketing.notification.application.service;

import com.techie.microservices.ticketing.notification.application.port.EmailSenderPort;
import com.techie.microservices.ticketing.notification.application.port.SendTicketNotificationUseCase;
import com.techie.microservices.ticketing.notification.infrastructure.messaging.dto.TicketIssuedEvent;
import com.techie.microservices.ticketing.notification.infrastructure.messaging.dto.TicketVoidedEvent;
import com.techie.microservices.ticketing.notification.infrastructure.messaging.dto.WaitlistOfferedEvent;
import com.techie.microservices.ticketing.notification.infrastructure.qr.QrImageRenderer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** Replaces the old e-commerce {@code NotificationApplicationService} - validate -> format ->
 * send, same structure, any send failure caught and logged rather than propagated (a flaky SMTP
 * provider must never fail the Kafka listener and trigger a redelivery loop). */
@Service
@RequiredArgsConstructor
@Slf4j
public class TicketNotificationApplicationService implements SendTicketNotificationUseCase {

    private static final String QR_CONTENT_ID = "qrcode";

    private final EmailSenderPort emailSenderPort;
    private final QrImageRenderer qrImageRenderer;

    @Value("${notification.mail.ticket-issued.subject}")
    private String ticketIssuedSubject;

    @Value("${notification.mail.ticket-issued.body-template}")
    private String ticketIssuedBodyTemplate;

    @Value("${notification.mail.waitlist-offered.subject}")
    private String waitlistOfferedSubject;

    @Value("${notification.mail.waitlist-offered.body-template}")
    private String waitlistOfferedBodyTemplate;

    @Value("${frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    @Value("${notification.mail.ticket-voided.subject}")
    private String ticketVoidedSubject;

    @Value("${notification.mail.ticket-voided.body-template}")
    private String ticketVoidedBodyTemplate;

    @Override
    public void handleTicketIssued(TicketIssuedEvent event) {
        if (event == null || !StringUtils.hasText(event.holderEmail()) || !StringUtils.hasText(event.qrPayload())) {
            throw new IllegalArgumentException(
                    "Cannot process ticket-issued notification: holderEmail or qrPayload is missing or blank. event=" + event);
        }

        String body = String.format(ticketIssuedBodyTemplate, nameOrFallback(event.holderName()), QR_CONTENT_ID);
        try {
            byte[] qrImage = qrImageRenderer.renderPng(event.qrPayload());
            emailSenderPort.sendWithInlineImage(event.holderEmail(), ticketIssuedSubject, body, qrImage, QR_CONTENT_ID);
            log.info("Ticket-issued email sent. ticketId={}, email={}", event.ticketId(), event.holderEmail());
        } catch (Exception e) {
            log.error("Failed to send ticket-issued email. ticketId={}, email={}, reason={}",
                    event.ticketId(), event.holderEmail(), e.getMessage(), e);
        }
    }

    @Override
    public void handleTicketVoided(TicketVoidedEvent event) {
        if (event == null || event.ticketId() == null) {
            throw new IllegalArgumentException("Cannot process ticket-voided notification: ticketId is missing. event=" + event);
        }
        if (!StringUtils.hasText(event.holderEmail())) {
            log.info("Ticket {} {} - no holder email on the event, notification skipped", event.ticketId(), event.status());
            return;
        }
        String what = switch (String.valueOf(event.status())) {
            case "REFUNDED" -> "has been refunded";
            case "TRANSFERRED" -> "has been transferred to another account";
            default -> "has been cancelled";
        };
        String reason = StringUtils.hasText(event.reason()) ? event.reason() : "no reason given";
        try {
            emailSenderPort.send(event.holderEmail(), ticketVoidedSubject,
                    String.format(ticketVoidedBodyTemplate, nameOrFallback(event.holderName()), what, reason));
            log.info("Ticket-voided email sent. ticketId={}, email={}", event.ticketId(), event.holderEmail());
        } catch (Exception e) {
            log.error("Failed to send ticket-voided email. ticketId={}, reason={}", event.ticketId(), e.getMessage(), e);
        }
    }

    @Override
    public void handleWaitlistOffered(WaitlistOfferedEvent event) {
        if (event == null || !StringUtils.hasText(event.holderEmail()) || event.reservationId() == null) {
            throw new IllegalArgumentException("Cannot process waitlist-offered notification: holderEmail or reservationId is missing. event=" + event);
        }
        String link = frontendBaseUrl + "/checkout/" + event.reservationId();
        String until = event.expiresAt() == null ? "a few minutes" : event.expiresAt().toString();
        try {
            emailSenderPort.send(event.holderEmail(), waitlistOfferedSubject,
                    String.format(waitlistOfferedBodyTemplate, nameOrFallback(event.holderName()), event.ticketCount(), event.eventName(), until, link));
            log.info("Waitlist-offered email sent. entryId={}, email={}", event.entryId(), event.holderEmail());
        } catch (Exception e) {
            log.error("Failed to send waitlist-offered email. entryId={}, reason={}", event.entryId(), e.getMessage(), e);
        }
    }

    private static String nameOrFallback(String name) {
        return StringUtils.hasText(name) ? name : "there";
    }
}
