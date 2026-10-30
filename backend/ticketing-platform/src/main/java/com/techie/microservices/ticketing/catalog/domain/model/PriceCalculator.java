package com.techie.microservices.ticketing.catalog.domain.model;

import java.util.ArrayList;
import java.util.List;

/**
 * The one place a reservation's price is computed - used both to quote and to actually reserve, so
 * what the buyer is shown is exactly what they are charged. Integer cents throughout; a unit's net
 * price is split across its bundle's tickets so the parts always add up to the whole to the cent.
 */
public final class PriceCalculator {

    private PriceCalculator() {
    }

    public record Result(long grossCents, long discountCents, long totalCents, List<Long> perTicketCents) {
        public int ticketCount() {
            return perTicketCents.size();
        }
    }

    /**
     * @param unitPriceCents price of one unit (one ticket, or one whole bundle)
     * @param bundleSize     tickets per unit (1 for ordinary tickets)
     * @param units          how many units are bought
     * @param coupon         optional, already validated by the caller
     */
    public static Result price(long unitPriceCents, int bundleSize, int units, Coupon coupon) {
        long discountPerUnit = coupon == null ? 0 : coupon.discountFor(unitPriceCents);
        long netPerUnit = unitPriceCents - discountPerUnit;
        List<Long> perTicket = new ArrayList<>(units * bundleSize);
        for (int u = 0; u < units; u++) {
            long base = netPerUnit / bundleSize;
            long remainder = netPerUnit % bundleSize;
            for (int t = 0; t < bundleSize; t++) {
                perTicket.add(base + (t < remainder ? 1 : 0));
            }
        }
        return new Result(unitPriceCents * units, discountPerUnit * units, netPerUnit * units, perTicket);
    }
}
