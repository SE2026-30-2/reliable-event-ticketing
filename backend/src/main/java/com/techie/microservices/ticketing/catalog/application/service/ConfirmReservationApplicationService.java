package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.ConfirmReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.ConfirmReservationUseCase;
import com.techie.microservices.ticketing.catalog.application.port.QrPayloadSignerPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.event.TicketIssuedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketQrClaims;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Resolves a reservation on payment success: every ticket in the reservation group transitions
 * RESERVED -> ISSUED, gets its QR payload signed for the first time (signing happens here, not at
 * reserve time - see {@link ReserveTicketApplicationService}), and the ticket type's held quota
 * moves from {@code reservedCount} to {@code issuedCount}.
 * <p>
 * Idempotent by construction: filters for tickets still in {@code RESERVED} and no-ops if none
 * remain (already confirmed by an earlier delivery of the same event, or cancelled/expired out
 * from under a very late redelivery) - this is what lets {@code PaymentEventListener} rely on
 * plain at-least-once Kafka delivery with no separate event-id dedup table.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ConfirmReservationApplicationService implements ConfirmReservationUseCase {

    private final TicketRepositoryPort ticketRepositoryPort;
    private final TicketTypeRepositoryPort ticketTypeRepositoryPort;
    private final QrPayloadSignerPort qrPayloadSignerPort;
    private final OutboxEventPublisherPort outboxEventPublisherPort;

    @Override
    public void confirmReservation(ConfirmReservationCommand command) {
        List<Ticket> reservedTickets = ticketRepositoryPort.findByReservationId(command.reservationId()).stream()
                .filter(ticket -> ticket.getStatus() == TicketStatus.RESERVED)
                .toList();
        if (reservedTickets.isEmpty()) {
            log.info("Reservation {} has no tickets still RESERVED - already resolved or unknown, ignoring",
                    command.reservationId());
            return;
        }

        UUID ticketTypeId = reservedTickets.get(0).getTicketTypeId();
        TicketType ticketType = ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)
                .orElseThrow(() -> new TicketTypeNotFoundException(ticketTypeId));

        Instant issuedAt = Instant.now();
        for (Ticket ticket : reservedTickets) {
            issueOne(ticket, issuedAt);
        }

        ticketType.setReservedCount(ticketType.getReservedCount() - reservedTickets.size());
        ticketType.setIssuedCount(ticketType.getIssuedCount() + reservedTickets.size());
        ticketTypeRepositoryPort.save(ticketType);

        log.info("Confirmed reservation {} - issued {} ticket(s)", command.reservationId(), reservedTickets.size());
    }

    private void issueOne(Ticket ticket, Instant issuedAt) {
        TicketQrClaims claims = new TicketQrClaims(
                ticket.getTicketId(),
                ticket.getEventId(),
                ticket.getTicketTypeId(),
                ticket.getValidFrom().getEpochSecond(),
                ticket.getValidUntil().getEpochSecond(),
                issuedAt.getEpochSecond(),
                ticket.getMaxEntries());
        String qrPayload = qrPayloadSignerPort.sign(claims);

        ticket.setStatus(TicketStatus.ISSUED);
        ticket.setIssuedAt(issuedAt);
        ticket.setQrPayload(qrPayload);
        ticketRepositoryPort.save(ticket);

        outboxEventPublisherPort.publish(
                ticket.getTicketId().toString(),
                "ticket-issued",
                "ticket-issued",
                new TicketIssuedEvent(
                        UUID.randomUUID(),
                        ticket.getTicketId(),
                        ticket.getEventId(),
                        ticket.getTicketTypeId(),
                        ticket.getHolderName(),
                        ticket.getHolderEmail(),
                        qrPayload,
                        ticket.getValidFrom(),
                        ticket.getValidUntil(),
                        issuedAt));
    }
}
