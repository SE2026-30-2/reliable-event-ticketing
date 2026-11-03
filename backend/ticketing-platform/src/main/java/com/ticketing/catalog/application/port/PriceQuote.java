package com.ticketing.catalog.application.port;

public record PriceQuote(long unitPriceCents, int ticketCount, long grossCents, long discountCents, long totalCents, String couponCode) {
}
