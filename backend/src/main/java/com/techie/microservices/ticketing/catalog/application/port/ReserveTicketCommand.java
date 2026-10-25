package com.techie.microservices.ticketing.catalog.application.port;

import java.util.UUID;

public record ReserveTicketCommand(
        /** The authenticated buyer (JWT subject) - owns the tickets; never taken from the request body. */
        String ownerEmail,
        UUID ticketTypeId,
        /** Units bought; a bundle type yields {@code quantity x bundleSize} tickets. */
        int quantity,
        String holderName,
        String holderEmail,
        /** Optional discount code. */
        String couponCode,
        /** Internal: set only by the waitlist promotion, which is entitled to the quota the waitlist itself is guarding. */
        boolean fromWaitlist
) {
    public ReserveTicketCommand(String ownerEmail, UUID ticketTypeId, int quantity, String holderName, String holderEmail, String couponCode) {
        this(ownerEmail, ticketTypeId, quantity, holderName, holderEmail, couponCode, false);
    }

    public ReserveTicketCommand(String ownerEmail, UUID ticketTypeId, int quantity, String holderName, String holderEmail) {
        this(ownerEmail, ticketTypeId, quantity, holderName, holderEmail, null, false);
    }
}
