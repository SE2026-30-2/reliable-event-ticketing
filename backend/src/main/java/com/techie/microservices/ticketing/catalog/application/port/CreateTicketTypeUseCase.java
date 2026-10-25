package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.TicketType;

public interface CreateTicketTypeUseCase {
    TicketType createTicketType(CreateTicketTypeCommand command);
}
