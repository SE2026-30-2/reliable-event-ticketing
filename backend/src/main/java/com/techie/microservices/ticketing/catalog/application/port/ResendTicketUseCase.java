package com.techie.microservices.ticketing.catalog.application.port;

import java.util.UUID;

public interface ResendTicketUseCase {
    /** Re-emails an ISSUED ticket (with its QR) to the holder. Same visibility rule as
     * {@link GetTicketUseCase#getTicketVisibleTo}; a ticket that is not ISSUED cannot be resent. */
    void resendTicket(UUID ticketId, String requesterEmail, boolean admin);
}
