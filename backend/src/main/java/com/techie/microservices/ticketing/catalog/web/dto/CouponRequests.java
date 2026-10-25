package com.techie.microservices.ticketing.catalog.web.dto;

import com.techie.microservices.ticketing.catalog.domain.model.Coupon;
import com.techie.microservices.ticketing.catalog.domain.model.CouponType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class CouponRequests {

    private CouponRequests() {
    }

    public record CreateCouponRequest(
            @NotBlank @Size(max = 40) String code,
            @NotNull CouponType type,
            /** PERCENT: 1..100. FIXED: cents off each ticket unit. */
            @Min(1) long value,
            /** Restrict to one ticket type; omitted = any type of the event. */
            UUID ticketTypeId,
            @Min(1) Integer maxRedemptions,
            Instant validFrom,
            Instant validUntil
    ) {
    }

    public record SetActiveRequest(@NotNull Boolean active) {
    }

    public record CouponResponse(UUID couponId, UUID eventId, String code, CouponType type, long value, UUID ticketTypeId,
                                 Integer maxRedemptions, int redeemedCount, Instant validFrom, Instant validUntil, boolean active) {
        public static CouponResponse from(Coupon c) {
            return new CouponResponse(c.getCouponId(), c.getEventId(), c.getCode(), c.getDiscountType(), c.getDiscountValue(),
                    c.getTicketTypeId(), c.getMaxRedemptions(), c.getRedeemedCount(), c.getValidFrom(), c.getValidUntil(), c.isActive());
        }
    }
}
