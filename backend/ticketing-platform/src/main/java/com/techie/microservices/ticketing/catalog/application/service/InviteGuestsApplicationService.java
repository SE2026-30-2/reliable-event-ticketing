package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.InviteGuestsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.QrPayloadSignerPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.event.TicketIssuedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotOpenException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidEventChangeException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeSoldOutException;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class InviteGuestsApplicationService implements InviteGuestsUseCase {

    static final int MAX_GUESTS_PER_CALL = 200;

    private final TicketTypeRepositoryPort ticketTypeRepositoryPort;
    private final TicketRepositoryPort ticketRepositoryPort;
    private final EventRepositoryPort eventRepositoryPort;
    private final QrPayloadSignerPort qrPayloadSignerPort;
    private final OutboxEventPublisherPort outboxEventPublisherPort;

    @Override
    public List<Ticket> inviteGuests(InviteGuestsCommand command) {
        if (command.guests() == null || command.guests().isEmpty()) {
            throw new InvalidEventChangeException("The guest list is empty");
        }
        if (command.guests().size() > MAX_GUESTS_PER_CALL) {
            throw new InvalidEventChangeException("At most " + MAX_GUESTS_PER_CALL + " guests per request");
        }
        Set<String> seen = new HashSet<>();
        for (Guest g : command.guests()) {
            String email = g.email() == null ? "" : g.email().trim().toLowerCase(Locale.ROOT);
            if (!email.contains("@") || email.length() > 255) {
                throw new InvalidEventChangeException("Invalid guest email: " + g.email());
            }
            if (!seen.add(email)) {
                throw new InvalidEventChangeException("Guest listed twice: " + email);
            }
        }

        var event = eventRepositoryPort.findByEventId(command.eventId()).orElseThrow(() -> new EventNotFoundException(command.eventId()));
        if (event.getStatus() == EventStatus.CANCELLED || event.getEndsAt().isBefore(Instant.now())) {
            throw new EventNotOpenException(event.getEventId());
        }
        TicketType type = ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(command.ticketTypeId())
                .filter(t -> t.getEventId().equals(command.eventId())) // another event's type looks missing
                .orElseThrow(() -> new TicketTypeNotFoundException(command.ticketTypeId()));
        int n = command.guests().size();
        if (!type.hasRemainingQuota(n)) {
            throw new TicketTypeSoldOutException(type.getTicketTypeId(), n,
                    type.getQuota() - type.getIssuedCount() - type.getReservedCount());
        }

        Instant now = Instant.now();
        List<Ticket> issued = new ArrayList<>(n);
        for (Guest guest : command.guests()) {
            String email = guest.email().trim().toLowerCase(Locale.ROOT);
            UUID id = UUID.randomUUID();
            String qr = qrPayloadSignerPort.sign(new TicketQrClaims(id, type.getEventId(), type.getTicketTypeId(),
                    type.getValidFrom().getEpochSecond(), type.getValidUntil().getEpochSecond(), now.getEpochSecond(), type.getMaxEntries()));
            Ticket ticket = ticketRepositoryPort.save(Ticket.builder()
                    .ticketId(id).ticketTypeId(type.getTicketTypeId()).eventId(type.getEventId())
                    .ownerEmail(email).holderName(guest.name()).holderEmail(email)
                    .status(TicketStatus.ISSUED).statusReason("guest invited by " + command.invitedBy())
                    .issuedAt(now).validFrom(type.getValidFrom()).validUntil(type.getValidUntil())
                    .qrPayload(qr).createdAt(now).source("GUEST").maxEntries(type.getMaxEntries()).priceCents(0)
                    .build());
            outboxEventPublisherPort.publish(id.toString(), "ticket-issued", "ticket-issued",
                    new TicketIssuedEvent(UUID.randomUUID(), id, ticket.getEventId(), ticket.getTicketTypeId(),
                            guest.name(), email, qr, ticket.getValidFrom(), ticket.getValidUntil(), now));
            issued.add(ticket);
        }
        type.setIssuedCount(type.getIssuedCount() + n);
        ticketTypeRepositoryPort.save(type);
        log.info("{} invited {} guest(s) to event {} ({})", command.invitedBy(), n, command.eventId(), type.getName());
        return issued;
    }
}
