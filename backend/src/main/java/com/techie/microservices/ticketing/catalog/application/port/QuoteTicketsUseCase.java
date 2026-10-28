package com.techie.microservices.ticketing.catalog.application.port;

import java.util.UUID;

public interface QuoteTicketsUseCase {
    /** What {@code quantity} units would cost with an optional coupon - read-only, reserves nothing. */
    PriceQuote quote(UUID ticketTypeId, int quantity, String couponCode);
}
