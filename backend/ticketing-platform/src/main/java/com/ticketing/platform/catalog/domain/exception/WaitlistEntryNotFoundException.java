package com.ticketing.platform.catalog.domain.exception;

import java.util.UUID;

public class WaitlistEntryNotFoundException extends RuntimeException {
    public WaitlistEntryNotFoundException(UUID entryId) {
        super("Waitlist entry not found: " + entryId);
    }
}
