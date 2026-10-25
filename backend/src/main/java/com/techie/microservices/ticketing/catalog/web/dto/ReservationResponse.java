package com.techie.microservices.ticketing.catalog.web.dto;

import com.techie.microservices.ticketing.catalog.application.port.ReservationResult;

import java.util.List;
import java.util.UUID;

public record ReservationResponse(UUID reservationId, List<TicketResponse> tickets, long totalCents, long discountCents) {
    public static ReservationResponse from(ReservationResult result) {
        return new ReservationResponse(
                result.reservationId(),
                result.tickets().stream().map(TicketResponse::from).toList(),
                result.totalCents(),
                result.discountCents());
    }
}
