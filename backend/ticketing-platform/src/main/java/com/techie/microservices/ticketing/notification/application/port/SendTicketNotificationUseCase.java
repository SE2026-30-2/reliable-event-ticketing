package com.techie.microservices.ticketing.notification.application.port;

import com.techie.microservices.ticketing.notification.infrastructure.messaging.dto.TicketIssuedEvent;
import com.techie.microservices.ticketing.notification.infrastructure.messaging.dto.TicketVoidedEvent;
import com.techie.microservices.ticketing.notification.infrastructure.messaging.dto.WaitlistOfferedEvent;

/** Replaces the old e-commerce {@code SendOrderNotificationUseCase} - same shape (validate ->
 * format -> send, failures caught and logged, never propagated to the Kafka listener), now for
 * the ticket domain's two buyer-facing events instead of order-service's. */
public interface SendTicketNotificationUseCase {
    void handleTicketIssued(TicketIssuedEvent event);

    void handleTicketVoided(TicketVoidedEvent event);

    /** A waiting buyer was given a time-limited hold on tickets: send them the link to pay. */
    void handleWaitlistOffered(WaitlistOfferedEvent event);
}
