package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.QrPayloadSignerPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TransferTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.TransferTicketUseCase;
import com.techie.microservices.ticketing.catalog.domain.event.TicketIssuedEvent;
import com.techie.microservices.ticketing.catalog.domain.event.TicketVoidedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotTransferableException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketQrClaims;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import com.techie.microservices.ticketing.shared.application.port.TicketUsagePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Why a transfer issues a new ticket instead of just changing the owner: the QR carries no owner,
 * so re-pointing the same ticket would leave the previous holder's copy (a screenshot, a forward)
 * fully valid and racing the new holder at the gate. A fresh ticket id means a fresh signature, and
 * voiding the old id kills every copy of the old QR.
 * <p>
 * Race with the gate: {@link TicketUsagePort#voidIfUnused} takes the same per-ticket lock the
 * check-in insert takes, so a scan landing at the same moment is serialised - either it was first
 * (the transfer is refused: "already used") or it comes after the commit and is rejected as voided.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TransferTicketApplicationService implements TransferTicketUseCase {

    private final TicketRepositoryPort ticketRepositoryPort;
    private final EventRepositoryPort eventRepositoryPort;
    private final QrPayloadSignerPort qrPayloadSignerPort;
    private final OutboxEventPublisherPort outboxEventPublisherPort;
    private final TicketUsagePort ticketUsagePort;

    /** A ticket may change hands this many times in total; stops scalper chains. 0 disables transfers. */
    @Value("${ticketing.transfer.max-per-ticket:2}")
    private int maxTransfers;

    /** No transfers this close to the start - the organizer has the final guest list by then. */
    @Value("${ticketing.transfer.cutoff-minutes-before-start:60}")
    private long cutoffMinutes;

    @Override
    public Ticket transferTicket(TransferTicketCommand command) {
        String to = command.toEmail().trim().toLowerCase();
        Ticket old = ticketRepositoryPort.findByTicketIdForUpdate(command.ticketId())
                .orElseThrow(() -> new TicketNotFoundException(command.ticketId()));
        if (old.getOwnerEmail() == null || !old.getOwnerEmail().equalsIgnoreCase(command.requesterEmail())) {
            throw new TicketNotFoundException(command.ticketId()); // not yours looks like missing
        }
        if (old.getStatus() != TicketStatus.ISSUED) {
            throw new TicketNotTransferableException("Only a valid (ISSUED) ticket can be transferred; this one is " + old.getStatus());
        }
        if (maxTransfers <= 0) {
            throw new TicketNotTransferableException("Ticket transfers are disabled");
        }
        if (old.getTransferCount() >= maxTransfers) {
            throw new TicketNotTransferableException("This ticket has already been transferred the maximum number of times (" + maxTransfers + ")");
        }
        if (to.equalsIgnoreCase(old.getOwnerEmail())) {
            throw new TicketNotTransferableException("The ticket already belongs to that account");
        }
        var event = eventRepositoryPort.findByEventId(old.getEventId()).orElseThrow(() -> new EventNotFoundException(old.getEventId()));
        if (Instant.now().isAfter(event.getStartsAt().minus(Duration.ofMinutes(cutoffMinutes)))) {
            throw new TicketNotTransferableException("Transfers are closed for this event");
        }
        if (!ticketUsagePort.voidIfUnused(old.getTicketId(), "transferred")) {
            throw new TicketNotTransferableException("This ticket has already been used to enter");
        }

        Instant now = Instant.now();
        old.setStatus(TicketStatus.TRANSFERRED);
        old.setStatusReason("transferred to " + to);
        ticketRepositoryPort.save(old);
        outboxEventPublisherPort.publish(old.getTicketId().toString(), "ticket-voided", "ticket-voided",
                new TicketVoidedEvent(UUID.randomUUID(), old.getTicketId(), old.getEventId(), TicketStatus.TRANSFERRED.name(),
                        "transferred to another account", now, old.getHolderName(), old.getHolderEmail()));

        UUID newId = UUID.randomUUID();
        String qr = qrPayloadSignerPort.sign(new TicketQrClaims(newId, old.getEventId(), old.getTicketTypeId(),
                old.getValidFrom().getEpochSecond(), old.getValidUntil().getEpochSecond(), now.getEpochSecond(), old.getMaxEntries()));
        Ticket created = ticketRepositoryPort.save(Ticket.builder()
                .ticketId(newId)
                .ticketTypeId(old.getTicketTypeId())
                .eventId(old.getEventId())
                .ownerEmail(to)
                .holderName(command.holderName() != null && !command.holderName().isBlank() ? command.holderName().trim() : null)
                .holderEmail(to)
                .status(TicketStatus.ISSUED)
                // Same reservation: a later refund of the original payment voids whichever ticket is currently valid.
                .reservationId(old.getReservationId())
                .issuedAt(now)
                .validFrom(old.getValidFrom())
                .validUntil(old.getValidUntil())
                .qrPayload(qr)
                .createdAt(now)
                .source("TRANSFER")
                .transferredFrom(old.getTicketId())
                .transferCount(old.getTransferCount() + 1)
                .maxEntries(old.getMaxEntries())
                .priceCents(old.getPriceCents()) // shown to the new holder; revenue counts only source=PURCHASE tickets
                .build());
        outboxEventPublisherPort.publish(newId.toString(), "ticket-issued", "ticket-issued",
                new TicketIssuedEvent(UUID.randomUUID(), newId, created.getEventId(), created.getTicketTypeId(),
                        created.getHolderName(), created.getHolderEmail(), qr, created.getValidFrom(), created.getValidUntil(), now));

        log.info("Ticket {} transferred -> new ticket {} (owner {})", old.getTicketId(), newId, to);
        return created;
    }
}
