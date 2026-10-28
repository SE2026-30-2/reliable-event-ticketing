package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.GetTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ResendTicketUseCase;
import com.techie.microservices.ticketing.catalog.domain.event.TicketResendRequestedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotResendableException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ResendTicketApplicationService implements ResendTicketUseCase {

    private final GetTicketUseCase getTicketUseCase;
    private final OutboxEventPublisherPort outboxEventPublisherPort;

    @Override
    public void resendTicket(UUID ticketId, String requesterEmail, boolean admin) {
        Ticket ticket = getTicketUseCase.getTicketVisibleTo(ticketId, requesterEmail, admin);
        if (ticket.getStatus() != TicketStatus.ISSUED) {
            throw new TicketNotResendableException(ticketId, ticket.getStatus());
        }
        outboxEventPublisherPort.publish(
                ticketId.toString(),
                "ticket-resend-requested",
                "ticket-resend-requested",
                new TicketResendRequestedEvent(
                        UUID.randomUUID(), ticketId, ticket.getEventId(), ticket.getTicketTypeId(),
                        ticket.getHolderName(), ticket.getHolderEmail(), ticket.getQrPayload(),
                        ticket.getValidFrom(), ticket.getValidUntil(), ticket.getIssuedAt()));
        log.info("Ticket {} resend requested by {}", ticketId, admin ? "an admin" : "its owner");
    }
}
