package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.GetReservationPaymentUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ReservationPayment;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotPayableException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetReservationPaymentApplicationService implements GetReservationPaymentUseCase {

    private final TicketRepositoryPort ticketRepositoryPort;

    @Override
    public ReservationPayment getPayableReservation(UUID reservationId, String requesterEmail) {
        List<Ticket> all = ownedTickets(reservationId, requesterEmail);
        List<Ticket> reserved = all.stream().filter(t -> t.getStatus() == TicketStatus.RESERVED).toList();
        if (reserved.isEmpty()) {
            throw new ReservationNotPayableException(reservationId, "already " + all.get(0).getStatus());
        }
        Instant now = Instant.now();
        if (reserved.stream().anyMatch(t -> t.getReservationExpiresAt() != null && t.getReservationExpiresAt().isBefore(now))) {
            throw new ReservationNotPayableException(reservationId, "the reservation has expired");
        }

        Instant expiresAt = reserved.stream().map(Ticket::getReservationExpiresAt).filter(java.util.Objects::nonNull)
                .min(Instant::compareTo).orElse(null);
        return new ReservationPayment(reservationId, reserved.stream().mapToLong(Ticket::getPriceCents).sum(), reserved.size(), expiresAt);
    }

    /** Deliberately ignores the expiry time: while a payment is pending the sweep leaves the
     * reservation RESERVED, so a confirmed payment that lands a moment after the hold lapsed must
     * still be honoured - the buyer already paid. Only a reservation that is no longer RESERVED
     * (cancelled by a failure) cannot be. */
    @Override
    public boolean isPayable(UUID reservationId) {
        return ticketRepositoryPort.findByReservationId(reservationId).stream()
                .anyMatch(t -> t.getStatus() == TicketStatus.RESERVED);
    }

    @Override
    public void assertReservationOwnedBy(UUID reservationId, String requesterEmail) {
        ownedTickets(reservationId, requesterEmail);
    }

    private List<Ticket> ownedTickets(UUID reservationId, String requesterEmail) {
        List<Ticket> all = ticketRepositoryPort.findByReservationId(reservationId);
        boolean mine = !all.isEmpty() && all.stream()
                .allMatch(t -> t.getOwnerEmail() != null && t.getOwnerEmail().equalsIgnoreCase(requesterEmail));
        if (!mine) {
            throw new ReservationNotFoundException(reservationId); // same answer for "missing" and "not yours"
        }
        return all;
    }
}
