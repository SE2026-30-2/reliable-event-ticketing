package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.GetTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListMyTicketsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListTicketsForEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TicketQueryApplicationService implements GetTicketUseCase, ListTicketsForEventUseCase, ListMyTicketsUseCase {

    private final TicketRepositoryPort ticketRepositoryPort;

    @Override
    public Ticket getTicket(UUID ticketId) {
        return ticketRepositoryPort.findByTicketId(ticketId)
                .orElseThrow(() -> new TicketNotFoundException(ticketId));
    }

    @Override
    public Ticket getTicketVisibleTo(UUID ticketId, String requesterEmail, boolean admin) {
        Ticket ticket = getTicket(ticketId);
        boolean owner = ticket.getOwnerEmail() != null && ticket.getOwnerEmail().equalsIgnoreCase(requesterEmail);
        if (!owner && !admin) {
            throw new TicketNotFoundException(ticketId);
        }
        return ticket;
    }

    @Override
    public Page<Ticket> listTicketsForEvent(UUID eventId, Pageable pageable) {
        return ticketRepositoryPort.findByEventId(eventId, pageable);
    }

    @Override
    public Page<Ticket> listMyTickets(String ownerEmail, Pageable pageable) {
        return ticketRepositoryPort.findByOwner(ownerEmail.trim().toLowerCase(), pageable);
    }
}
