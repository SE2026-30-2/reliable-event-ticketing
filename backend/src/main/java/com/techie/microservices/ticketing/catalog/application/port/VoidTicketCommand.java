package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;

import java.util.UUID;

public record VoidTicketCommand(
        UUID ticketId,
        TicketStatus status,
        String reason
) {
}
