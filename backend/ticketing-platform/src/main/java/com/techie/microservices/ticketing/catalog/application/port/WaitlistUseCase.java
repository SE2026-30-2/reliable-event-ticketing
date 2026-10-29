package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.WaitlistEntry;

import java.util.List;
import java.util.UUID;

public interface WaitlistUseCase {

    record JoinWaitlistCommand(String ownerEmail, UUID ticketTypeId, int quantity, String holderName, String holderEmail) {
    }

    /** @throws com.techie.microservices.ticketing.catalog.domain.exception.WaitlistException not sold out for that quantity,
     *         already in line, too many lists, or the event is closed */
    WaitlistEntry join(JoinWaitlistCommand command);

    List<WaitlistEntry> listMine(String ownerEmail);

    /** Leaves the line; if an offer was already made, its reservation is released too.
     * @throws com.techie.microservices.ticketing.catalog.domain.exception.WaitlistEntryNotFoundException not the caller's entry */
    WaitlistEntry leave(UUID entryId, String ownerEmail);
}
