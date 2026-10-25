package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.ReservationResult;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.WaitlistRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.event.WaitlistOfferedEvent;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistEntry;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Turns freed-up quota into offers. Each method is its own transaction and is called from the
 * scheduled job (a different bean, so the transactional proxy applies): a failed attempt rolls back
 * cleanly and the job simply moves on to the next entry.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WaitlistPromotionService {

    private final WaitlistRepositoryPort waitlistRepositoryPort;
    private final TicketRepositoryPort ticketRepositoryPort;
    private final TicketTypeRepositoryPort ticketTypeRepositoryPort;
    private final EventRepositoryPort eventRepositoryPort;
    private final ReserveTicketUseCase reserveTicketUseCase;
    private final OutboxEventPublisherPort outboxEventPublisherPort;

    /** Ticket types that have someone waiting. */
    @Transactional(readOnly = true)
    public List<UUID> ticketTypesWithWaiting() {
        return waitlistRepositoryPort.findTicketTypeIdsWithWaiting();
    }

    /** Oldest first. */
    @Transactional(readOnly = true)
    public List<WaitlistEntry> waiting(UUID ticketTypeId) {
        return waitlistRepositoryPort.findWaiting(ticketTypeId);
    }

    /**
     * Gives this entry a reservation if the quota now covers it. Throws (rolling back, nothing changed)
     * when it does not fit or the hold cannot be made - the caller decides whether that means "try the next
     * entry" or "give up on this one".
     *
     * @return false if the entry is no longer WAITING (cancelled, or taken by another instance)
     */
    @Transactional
    public boolean promote(UUID entryId) {
        var locked = waitlistRepositoryPort.findByEntryIdForUpdateSkipLocked(entryId)
                .filter(e -> e.getStatus() == WaitlistStatus.WAITING);
        if (locked.isEmpty()) {
            return false;
        }
        WaitlistEntry entry = locked.get();
        ReservationResult reservation = reserveTicketUseCase.reserveTickets(new ReserveTicketCommand(
                entry.getOwnerEmail(), entry.getTicketTypeId(), entry.getQuantity(), entry.getHolderName(), entry.getHolderEmail(), null, true));

        Instant expiresAt = reservation.tickets().get(0).getReservationExpiresAt();
        entry.setStatus(WaitlistStatus.OFFERED);
        entry.setReservationId(reservation.reservationId());
        entry.setOfferedAt(Instant.now());
        waitlistRepositoryPort.save(entry);

        TicketType type = ticketTypeRepositoryPort.findByTicketTypeId(entry.getTicketTypeId()).orElseThrow();
        String eventName = eventRepositoryPort.findByEventId(type.getEventId()).map(e -> e.getName()).orElse("your event");
        outboxEventPublisherPort.publish(entry.getEntryId().toString(), "waitlist-offered", "waitlist-offered",
                new WaitlistOfferedEvent(UUID.randomUUID(), entry.getEntryId(), entry.getHolderName(), entry.getHolderEmail(),
                        reservation.reservationId(), eventName, reservation.tickets().size(), expiresAt));
        log.info("Waitlist entry {} offered reservation {}", entry.getEntryId(), reservation.reservationId());
        return true;
    }

    /** The entry can never be fulfilled (event closed, account over its hold cap...): take it off the list. */
    @Transactional
    public void giveUp(UUID entryId, String reason) {
        waitlistRepositoryPort.findByEntryId(entryId).filter(e -> e.getStatus() == WaitlistStatus.WAITING).ifPresent(e -> {
            e.setStatus(WaitlistStatus.EXPIRED);
            e.setFailureReason(reason.length() > 250 ? reason.substring(0, 250) : reason);
            waitlistRepositoryPort.save(e);
        });
    }

    /** Offers settle one way or the other: paid (CONVERTED) or lapsed/cancelled unpaid (EXPIRED). */
    @Transactional
    public int settleOffers() {
        int settled = 0;
        for (WaitlistEntry entry : waitlistRepositoryPort.findByStatus(WaitlistStatus.OFFERED)) {
            List<Ticket> tickets = ticketRepositoryPort.findByReservationId(entry.getReservationId());
            boolean anyIssued = tickets.stream().anyMatch(t -> t.getStatus() == TicketStatus.ISSUED);
            boolean stillHeld = tickets.stream().anyMatch(t -> t.getStatus() == TicketStatus.RESERVED);
            if (anyIssued) {
                entry.setStatus(WaitlistStatus.CONVERTED);
            } else if (!stillHeld) {
                entry.setStatus(WaitlistStatus.EXPIRED);
                entry.setFailureReason("offer not paid in time");
            } else {
                continue;
            }
            waitlistRepositoryPort.save(entry);
            settled++;
        }
        return settled;
    }
}
