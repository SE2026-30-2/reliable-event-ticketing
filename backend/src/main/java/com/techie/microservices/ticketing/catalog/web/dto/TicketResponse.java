package com.techie.microservices.ticketing.catalog.web.dto;

import com.techie.microservices.ticketing.catalog.domain.model.Ticket;

import java.time.Instant;
import java.util.UUID;

public record TicketResponse(
        UUID ticketId,
        UUID ticketTypeId,
        UUID eventId,
        String ownerEmail,
        String holderName,
        String holderEmail,
        String status,
        String statusReason,
        UUID reservationId,
        Instant reservationExpiresAt,
        Instant issuedAt,
        Instant validFrom,
        Instant validUntil,
        String qrPayload,
        String source,
        int maxEntries,
        int transferCount,
        long priceCents
) {
    /** For listings shown to someone who is not the ticket's holder (an organizer): the QR is the holder's. */
    public TicketResponse withoutQr() {
        return new TicketResponse(ticketId, ticketTypeId, eventId, ownerEmail, holderName, holderEmail, status, statusReason,
                reservationId, reservationExpiresAt, issuedAt, validFrom, validUntil, null, source, maxEntries, transferCount, priceCents);
    }

    public static TicketResponse from(Ticket ticket) {
        return new TicketResponse(
                ticket.getTicketId(),
                ticket.getTicketTypeId(),
                ticket.getEventId(),
                ticket.getOwnerEmail(),
                ticket.getHolderName(),
                ticket.getHolderEmail(),
                ticket.getStatus().name(),
                ticket.getStatusReason(),
                ticket.getReservationId(),
                ticket.getReservationExpiresAt(),
                ticket.getIssuedAt(),
                ticket.getValidFrom(),
                ticket.getValidUntil(),
                ticket.getQrPayload(),
                ticket.getSource(),
                ticket.getMaxEntries(),
                ticket.getTransferCount(),
                ticket.getPriceCents());
    }
}
