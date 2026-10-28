package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Coupon;
import com.techie.microservices.ticketing.catalog.domain.model.CouponType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Authorization is the caller's job (EventAccessPort); these enforce data rules only. */
public interface ManageCouponsUseCase {

    record CreateCouponCommand(UUID eventId, String code, CouponType type, long value, UUID ticketTypeId,
                               Integer maxRedemptions, Instant validFrom, Instant validUntil, String createdBy) {
    }

    Coupon createCoupon(CreateCouponCommand command);

    List<Coupon> listCoupons(UUID eventId);

    /** @throws com.techie.microservices.ticketing.catalog.domain.exception.CouponNotFoundException if it is not this event's coupon */
    Coupon setActive(UUID eventId, UUID couponId, boolean active);
}
