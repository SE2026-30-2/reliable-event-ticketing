package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ListMyTicketsUseCase {
    Page<Ticket> listMyTickets(String ownerEmail, Pageable pageable);
}
