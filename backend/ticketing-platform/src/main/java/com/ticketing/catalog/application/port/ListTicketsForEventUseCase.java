package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface ListTicketsForEventUseCase {
    Page<Ticket> listTicketsForEvent(UUID eventId, Pageable pageable);
}
