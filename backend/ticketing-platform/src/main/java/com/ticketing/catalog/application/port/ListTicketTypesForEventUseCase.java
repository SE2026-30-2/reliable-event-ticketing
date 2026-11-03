package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.TicketType;

import java.util.List;
import java.util.UUID;

public interface ListTicketTypesForEventUseCase {
    List<TicketType> listTicketTypesForEvent(UUID eventId);
}
