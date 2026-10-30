package com.techie.microservices.ticketing.catalog.application.port;

import java.util.UUID;

public record TransferTicketCommand(UUID ticketId, String requesterEmail, String toEmail, String holderName) {
}
