package com.ticketing.platform.shared.application.port;

import com.ticketing.platform.shared.domain.Actor;

import java.util.UUID;

/**
 * The one rule for "may this caller manage this event": ADMIN any event, ORGANIZER only events they
 * created. Implemented by catalog (which owns events); every other module that exposes
 * per-event management (check-in devices, stats, reports) asks through this port instead of
 * re-deriving ownership, so the rule cannot drift between modules.
 */
public interface EventAccessPort {

    boolean canManage(UUID eventId, Actor actor);

    /** @throws com.ticketing.platform.catalog.domain.exception.EventNotFoundException
     * if the event does not exist OR the actor may not manage it - the same answer for both, so
     * an organizer cannot probe for other organizers' event ids. */
    void assertCanManage(UUID eventId, Actor actor);
}
