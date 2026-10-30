package com.techie.microservices.ticketing.catalog.application.port;

public interface ReserveTicketUseCase {
    ReservationResult reserveTickets(ReserveTicketCommand command);
}
