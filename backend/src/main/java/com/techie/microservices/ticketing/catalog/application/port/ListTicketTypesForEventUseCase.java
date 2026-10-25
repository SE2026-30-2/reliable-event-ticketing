package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.TicketType;

import java.util.List;
import java.util.UUID;

public interface ListTicketTypesForEventUseCase {
    List<TicketType> listTicketTypesForEvent(UUID eventId);
}
