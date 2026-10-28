package com.techie.microservices.ticketing.catalog.web.dto;

import java.util.UUID;

/** Deliberately omits the new ticket's QR: it belongs to the recipient now. */
public record TransferTicketResponse(UUID oldTicketId, UUID newTicketId, String toEmail) {
}
