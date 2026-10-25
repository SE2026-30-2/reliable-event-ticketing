package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Ticket;

public interface VoidTicketUseCase {
    Ticket voidTicket(VoidTicketCommand command);
}
