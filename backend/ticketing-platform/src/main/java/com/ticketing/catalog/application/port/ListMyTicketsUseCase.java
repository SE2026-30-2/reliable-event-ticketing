package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ListMyTicketsUseCase {
    Page<Ticket> listMyTickets(String ownerEmail, Pageable pageable);
}
