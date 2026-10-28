package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Ticket;

import java.util.List;
import java.util.UUID;

/** Complimentary tickets issued by the organizer to a guest list - no payment, no reservation. */
public interface InviteGuestsUseCase {

    record Guest(String name, String email) {
    }

    record InviteGuestsCommand(UUID eventId, UUID ticketTypeId, List<Guest> guests, String invitedBy) {
    }

    /**
     * Issues one ISSUED ticket per guest (QR signed and emailed to them, owned by their account email so
     * they also see it in My Tickets), counted against the ticket type's quota at price 0.
     * All or nothing: if the quota cannot cover the whole list, nothing is issued.
     */
    List<Ticket> inviteGuests(InviteGuestsCommand command);
}
