package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.Ticket;

public interface VoidTicketUseCase {
    Ticket voidTicket(VoidTicketCommand command);
}
