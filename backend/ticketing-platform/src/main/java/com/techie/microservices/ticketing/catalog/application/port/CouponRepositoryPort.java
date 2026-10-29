package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.Coupon;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CouponRepositoryPort {
    Coupon save(Coupon coupon);

    Optional<Coupon> findByCouponId(UUID couponId);

    Optional<Coupon> findByEventIdAndCode(UUID eventId, String code);

    /** Row-locks the coupon so redemption counting is safe under concurrent reservations. */
    Optional<Coupon> findByEventIdAndCodeForUpdate(UUID eventId, String code);

    Optional<Coupon> findByCouponIdForUpdate(UUID couponId);

    List<Coupon> findByEventId(UUID eventId);
}
