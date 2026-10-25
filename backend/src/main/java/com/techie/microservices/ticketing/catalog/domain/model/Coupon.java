package com.techie.microservices.ticketing.catalog.domain.model;

import com.techie.microservices.ticketing.catalog.domain.exception.InvalidCouponException;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Coupon {
    private Long id;
    private UUID couponId;
    private UUID eventId;
    /** Upper-case. */
    private String code;
    private CouponType discountType;
    private long discountValue;
    /** Null = any ticket type of the event. */
    private UUID ticketTypeId;
    /** Null = unlimited. Counted per reservation, released when a reservation is cancelled. */
    private Integer maxRedemptions;
    private int redeemedCount;
    private Instant validFrom;
    private Instant validUntil;
    private boolean active;
    private String createdBy;
    private Instant createdAt;

    /** @throws InvalidCouponException with a buyer-facing reason if this cannot be used for {@code ticketType} now. */
    public void assertUsableFor(TicketType ticketType, Instant now) {
        if (!active) {
            throw new InvalidCouponException("this coupon is no longer active");
        }
        if (!eventId.equals(ticketType.getEventId()) || (ticketTypeId != null && !ticketTypeId.equals(ticketType.getTicketTypeId()))) {
            throw new InvalidCouponException("this coupon does not apply to the selected ticket");
        }
        if (validFrom != null && now.isBefore(validFrom)) {
            throw new InvalidCouponException("this coupon is not valid yet");
        }
        if (validUntil != null && now.isAfter(validUntil)) {
            throw new InvalidCouponException("this coupon has expired");
        }
        if (maxRedemptions != null && redeemedCount >= maxRedemptions) {
            throw new InvalidCouponException("this coupon has been fully redeemed");
        }
    }

    /** What this coupon takes off one unit priced {@code unitPriceCents}; never more than the price. */
    public long discountFor(long unitPriceCents) {
        long off = discountType == CouponType.PERCENT ? unitPriceCents * discountValue / 100 : discountValue;
        return Math.min(off, unitPriceCents);
    }
}
