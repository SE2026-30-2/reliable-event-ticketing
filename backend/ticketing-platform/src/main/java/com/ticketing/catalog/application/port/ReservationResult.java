package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.Ticket;

import java.util.List;
import java.util.UUID;

public record ReservationResult(UUID reservationId, List<Ticket> tickets, long totalCents, long discountCents) {
    public ReservationResult(UUID reservationId, List<Ticket> tickets) {
        this(reservationId, tickets, tickets.stream().mapToLong(Ticket::getPriceCents).sum(), 0);
    }
}
