package com.ticketing.platform.shared.application.port;

import java.util.UUID;

/**
 * Catalog's window into check-in state, for operations that must not race a gate scan (transfer).
 * Implemented by the check-in module, which owns that state.
 */
public interface TicketUsagePort {

    /**
     * Atomically: if the ticket has never been checked in, make the gate reject it from now on and
     * return {@code true}; if it has already been scanned in, change nothing and return
     * {@code false}. Takes the same per-ticket lock the check-in insert takes, and holds it until the
     * caller's transaction ends, so a scan is either fully before this (then this returns false) or
     * fully after the caller commits (then the scan sees the ticket as voided).
     */
    boolean voidIfUnused(UUID ticketId, String reason);
}
