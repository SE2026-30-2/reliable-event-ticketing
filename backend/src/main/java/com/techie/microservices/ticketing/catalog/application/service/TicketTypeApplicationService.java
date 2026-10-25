package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeUseCase;
import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.ListTicketTypesForEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TicketTypeApplicationService implements CreateTicketTypeUseCase, ListTicketTypesForEventUseCase {

    private final TicketTypeRepositoryPort ticketTypeRepositoryPort;
    private final EventRepositoryPort eventRepositoryPort;

    @Override
    public TicketType createTicketType(CreateTicketTypeCommand command) {
        eventRepositoryPort.findByEventId(command.eventId())
                .orElseThrow(() -> new EventNotFoundException(command.eventId()));

        TicketType ticketType = TicketType.builder()
                .ticketTypeId(UUID.randomUUID())
                .eventId(command.eventId())
                .name(command.name())
                .priceCents(command.priceCents())
                .quota(command.quota())
                .issuedCount(0)
                .validFrom(command.validFrom())
                .validUntil(command.validUntil())
                .createdAt(Instant.now())
                .maxEntries(Math.max(1, command.maxEntries()))
                .bundleSize(Math.max(1, command.bundleSize()))
                .build();
        return ticketTypeRepositoryPort.save(ticketType);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TicketType> listTicketTypesForEvent(UUID eventId) {
        return ticketTypeRepositoryPort.findByEventId(eventId);
    }
}
