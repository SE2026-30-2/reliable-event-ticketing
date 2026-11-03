package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.TicketType;

public interface CreateTicketTypeUseCase {
    TicketType createTicketType(CreateTicketTypeCommand command);
}
