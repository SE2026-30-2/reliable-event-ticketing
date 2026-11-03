package com.ticketing.catalog.application.port;

import com.ticketing.catalog.domain.model.Ticket;

public interface TransferTicketUseCase {
    /**
     * Moves an ISSUED ticket to another account by voiding it and issuing a NEW ticket (new id, new
     * QR) to the recipient - the old QR, even if screenshotted, dies at the gate.
     *
     * @return the new ticket (its QR must not be handed back to the sender)
     * @throws com.ticketing.catalog.domain.exception.TicketNotFoundException not the requester's ticket
     * @throws com.ticketing.catalog.domain.exception.TicketNotTransferableException wrong state, limit reached,
     *         transfers closed, already scanned in, or recipient is the sender
     */
    Ticket transferTicket(TransferTicketCommand command);
}
