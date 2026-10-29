package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.CancelReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.CancelReservationUseCase;
import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.WaitlistRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.WaitlistUseCase;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.WaitlistEntryNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.WaitlistException;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistEntry;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class WaitlistApplicationService implements WaitlistUseCase {

    private final WaitlistRepositoryPort waitlistRepositoryPort;
    private final TicketTypeRepositoryPort ticketTypeRepositoryPort;
    private final EventRepositoryPort eventRepositoryPort;
    private final CancelReservationUseCase cancelReservationUseCase;

    /** Caps how many lines one account can stand in at once. */
    @Value("${ticketing.waitlist.max-active-per-account:5}")
    private int maxActivePerAccount;

    @Override
    public WaitlistEntry join(JoinWaitlistCommand c) {
        String owner = c.ownerEmail().trim().toLowerCase();
        // Locked so the sold-out check and the queue insert see the same quota (no joining a line that just emptied).
        TicketType type = ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(c.ticketTypeId())
                .orElseThrow(() -> new TicketTypeNotFoundException(c.ticketTypeId()));
        var event = eventRepositoryPort.findByEventId(type.getEventId()).orElseThrow(() -> new TicketTypeNotFoundException(c.ticketTypeId()));
        if (!event.isOpenForSales(Instant.now())) {
            throw new WaitlistException("This event is not open for sales");
        }
        int tickets = c.quantity() * type.getBundleSize();
        int remaining = type.getQuota() - type.getIssuedCount() - type.getReservedCount();
        long ahead = waitlistRepositoryPort.sumWaitingQuantity(type.getTicketTypeId()) * type.getBundleSize();
        if (remaining - ahead >= tickets) {
            throw new WaitlistException("Tickets are available right now - reserve them instead of waiting");
        }
        if (waitlistRepositoryPort.findActive(type.getTicketTypeId(), owner).isPresent()) {
            throw new WaitlistException("You are already on the waiting list for this ticket");
        }
        if (waitlistRepositoryPort.countActiveByOwner(owner) >= maxActivePerAccount) {
            throw new WaitlistException("You can wait on at most " + maxActivePerAccount + " lists at once");
        }
        WaitlistEntry saved = waitlistRepositoryPort.save(WaitlistEntry.builder()
                .entryId(UUID.randomUUID()).ticketTypeId(type.getTicketTypeId()).ownerEmail(owner)
                .holderName(c.holderName()).holderEmail(c.holderEmail().trim().toLowerCase())
                .quantity(c.quantity()).status(WaitlistStatus.WAITING).createdAt(Instant.now()).build());
        log.info("{} joined the waitlist for ticket type {} ({} unit(s))", owner, type.getTicketTypeId(), c.quantity());
        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public List<WaitlistEntry> listMine(String ownerEmail) {
        return waitlistRepositoryPort.findByOwner(ownerEmail.trim().toLowerCase(), 50);
    }

    @Override
    public WaitlistEntry leave(UUID entryId, String ownerEmail) {
        WaitlistEntry entry = waitlistRepositoryPort.findByEntryId(entryId)
                .filter(e -> e.getOwnerEmail().equalsIgnoreCase(ownerEmail)) // not yours looks like missing
                .orElseThrow(() -> new WaitlistEntryNotFoundException(entryId));
        if (entry.getStatus() == WaitlistStatus.WAITING) {
            entry.setStatus(WaitlistStatus.CANCELLED);
        } else if (entry.getStatus() == WaitlistStatus.OFFERED) {
            // Declining an offer gives its held tickets straight back to the next in line.
            cancelReservationUseCase.cancelReservation(new CancelReservationCommand(entry.getReservationId(), "waitlist offer declined"));
            entry.setStatus(WaitlistStatus.CANCELLED);
        } else {
            throw new WaitlistException("This entry is already " + entry.getStatus());
        }
        return waitlistRepositoryPort.save(entry);
    }
}
