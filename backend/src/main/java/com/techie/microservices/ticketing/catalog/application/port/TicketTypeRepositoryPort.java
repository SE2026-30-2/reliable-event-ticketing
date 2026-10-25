package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.TicketType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketTypeRepositoryPort {
    TicketType save(TicketType ticketType);

    Optional<TicketType> findByTicketTypeId(UUID ticketTypeId);

    /** Row-locks the ticket type for the duration of the caller's transaction - see
     * IssueTicketApplicationService, which relies on this to make the quota check-then-increment
     * safe under concurrent purchases of the same ticket type. */
    Optional<TicketType> findByTicketTypeIdForUpdate(UUID ticketTypeId);

    List<TicketType> findByEventId(UUID eventId);
}
