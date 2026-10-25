package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Ticket;

import java.util.UUID;

public interface GetTicketUseCase {
    /** Unrestricted lookup - internal/ADMIN use; never expose directly to a buyer. */
    Ticket getTicket(UUID ticketId);

    /**
     * The only lookup a buyer-facing endpoint should use: returns the ticket if {@code requester}
     * owns it (or is an admin); otherwise throws {@code TicketNotFoundException} - deliberately the
     * same error as a missing ticket, so ids cannot be probed for existence.
     */
    Ticket getTicketVisibleTo(UUID ticketId, String requesterEmail, boolean admin);
}
