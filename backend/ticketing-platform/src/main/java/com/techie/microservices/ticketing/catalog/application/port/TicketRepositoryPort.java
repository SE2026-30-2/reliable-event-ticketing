package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketRepositoryPort {
    Ticket save(Ticket ticket);

    Optional<Ticket> findByTicketId(UUID ticketId);

    /** Row-locks the ticket for the rest of the transaction (transfer serialises on this). */
    Optional<Ticket> findByTicketIdForUpdate(UUID ticketId);

    Page<Ticket> findByEventId(UUID eventId, Pageable pageable);

    /** Every ticket created by one reserve call shares this id - used to resolve them together
     * when a payment outcome arrives. */
    List<Ticket> findByReservationId(UUID reservationId);

    /** RESERVED tickets whose reservation window lapsed before {@code before} - see
     * {@code ExpireReservationsJob}. */
    List<Ticket> findExpiredReservations(Instant before);

    /** Tickets currently RESERVED by this buyer account (case-insensitive) - the abuse cap's input. */
    long countActiveReservationsByOwner(String ownerEmail);

    long countByEventIdAndStatus(UUID eventId, TicketStatus status);

    /** A buyer's own tickets; the caller supplies the sort (newest first for "my tickets"). */
    Page<Ticket> findByOwner(String ownerEmail, Pageable pageable);
}
