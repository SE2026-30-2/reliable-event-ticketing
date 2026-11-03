package com.ticketing.catalog.application.port;

public interface ReserveTicketUseCase {
    ReservationResult reserveTickets(ReserveTicketCommand command);
}
