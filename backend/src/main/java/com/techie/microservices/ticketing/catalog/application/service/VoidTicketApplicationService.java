package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.VoidTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.VoidTicketUseCase;
import com.techie.microservices.ticketing.catalog.domain.event.TicketVoidedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidTicketStatusTransitionException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Transitions a ticket ISSUED -> VOID/REFUNDED and writes the {@code ticket-voided} outbox event
 * in the same transaction - checkin-service consumes it to update its {@code valid_tickets} cache
 * so a subsequent check-in is rejected, since the original signed QR payload can never reflect a
 * status change that happens after issuance.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class VoidTicketApplicationService implements VoidTicketUseCase {

    private final TicketRepositoryPort ticketRepositoryPort;
    private final OutboxEventPublisherPort outboxEventPublisherPort;

    @Override
    public Ticket voidTicket(VoidTicketCommand command) {
        Ticket ticket = ticketRepositoryPort.findByTicketId(command.ticketId())
                .orElseThrow(() -> new TicketNotFoundException(command.ticketId()));

        // The admin endpoint only voids/refunds; TRANSFERRED is reachable solely through the transfer use case.
        if (command.status() != TicketStatus.VOID && command.status() != TicketStatus.REFUNDED
                || !ticket.getStatus().canTransitionTo(command.status())) {
            throw new InvalidTicketStatusTransitionException(command.ticketId(), ticket.getStatus(), command.status());
        }

        Instant changedAt = Instant.now();
        ticket.setStatus(command.status());
        ticket.setStatusReason(command.reason());
        Ticket saved = ticketRepositoryPort.save(ticket);

        outboxEventPublisherPort.publish(
                ticket.getTicketId().toString(),
                "ticket-voided",
                "ticket-voided",
                new TicketVoidedEvent(
                        UUID.randomUUID(),
                        ticket.getTicketId(),
                        ticket.getEventId(),
                        command.status().name(),
                        command.reason(),
                        changedAt,
                        ticket.getHolderName(),
                        ticket.getHolderEmail()));

        log.info("Ticket {} transitioned to {} ({})", ticket.getTicketId(), command.status(), command.reason());
        return saved;
    }
}
