package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.RefundReservationUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.event.TicketVoidedEvent;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Applies a provider refund to the tickets it paid for. Quota is deliberately NOT released: a
 * refunded ticket is a terminal state exactly like a voided one, and handing the seat straight back
 * to the pool would let a refund-and-rebuy loop cycle the same capacity (and a refund is normally
 * an exceptional, admin-driven act, not a way to resell).
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class RefundReservationApplicationService implements RefundReservationUseCase {

    private final TicketRepositoryPort ticketRepositoryPort;
    private final OutboxEventPublisherPort outboxEventPublisherPort;

    @Override
    public void refundReservation(UUID reservationId) {
        int refunded = 0;
        for (Ticket ticket : ticketRepositoryPort.findByReservationId(reservationId)) {
            if (!ticket.getStatus().canTransitionTo(TicketStatus.REFUNDED)) {
                continue;
            }
            ticket.setStatus(TicketStatus.REFUNDED);
            ticket.setStatusReason("payment refunded");
            ticketRepositoryPort.save(ticket);
            outboxEventPublisherPort.publish(
                    ticket.getTicketId().toString(), "ticket-voided", "ticket-voided",
                    new TicketVoidedEvent(UUID.randomUUID(), ticket.getTicketId(), ticket.getEventId(),
                            TicketStatus.REFUNDED.name(), "payment refunded", Instant.now(),
                            ticket.getHolderName(), ticket.getHolderEmail()));
            refunded++;
        }
        log.info("Reservation {} refunded - {} ticket(s) marked REFUNDED", reservationId, refunded);
    }
}
