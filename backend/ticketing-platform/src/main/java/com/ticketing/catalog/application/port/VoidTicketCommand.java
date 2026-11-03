package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.TicketStatus;

import java.util.UUID;

public record VoidTicketCommand(
        UUID ticketId,
        TicketStatus status,
        String reason
) {
}
