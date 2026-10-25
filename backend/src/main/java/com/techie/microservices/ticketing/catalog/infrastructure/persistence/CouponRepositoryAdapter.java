package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import com.techie.microservices.ticketing.catalog.application.port.CouponRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.Coupon;
import com.techie.microservices.ticketing.catalog.domain.model.CouponType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CouponRepositoryAdapter implements CouponRepositoryPort {

    private final SpringDataCouponJpaRepository jpa;

    @Override
    public Coupon save(Coupon coupon) {
        return toDomain(jpa.save(toEntity(coupon)));
    }

    @Override
    public Optional<Coupon> findByCouponId(UUID couponId) {
        return jpa.findByCouponId(couponId).map(CouponRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<Coupon> findByEventIdAndCode(UUID eventId, String code) {
        return jpa.findByEventIdAndCode(eventId, code).map(CouponRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<Coupon> findByEventIdAndCodeForUpdate(UUID eventId, String code) {
        return jpa.findByEventIdAndCodeForUpdate(eventId, code).map(CouponRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<Coupon> findByCouponIdForUpdate(UUID couponId) {
        return jpa.findByCouponIdForUpdate(couponId).map(CouponRepositoryAdapter::toDomain);
    }

    @Override
    public List<Coupon> findByEventId(UUID eventId) {
        return jpa.findByEventIdOrderByCreatedAtDesc(eventId).stream().map(CouponRepositoryAdapter::toDomain).toList();
    }

    private static CouponEntity toEntity(Coupon c) {
        return CouponEntity.builder().id(c.getId()).couponId(c.getCouponId()).eventId(c.getEventId()).code(c.getCode())
                .discountType(c.getDiscountType().name()).discountValue(c.getDiscountValue()).ticketTypeId(c.getTicketTypeId())
                .maxRedemptions(c.getMaxRedemptions()).redeemedCount(c.getRedeemedCount()).validFrom(c.getValidFrom())
                .validUntil(c.getValidUntil()).active(c.isActive()).createdBy(c.getCreatedBy()).createdAt(c.getCreatedAt()).build();
    }

    private static Coupon toDomain(CouponEntity e) {
        return Coupon.builder().id(e.getId()).couponId(e.getCouponId()).eventId(e.getEventId()).code(e.getCode())
                .discountType(CouponType.valueOf(e.getDiscountType())).discountValue(e.getDiscountValue()).ticketTypeId(e.getTicketTypeId())
                .maxRedemptions(e.getMaxRedemptions()).redeemedCount(e.getRedeemedCount()).validFrom(e.getValidFrom())
                .validUntil(e.getValidUntil()).active(e.isActive()).createdBy(e.getCreatedBy()).createdAt(e.getCreatedAt()).build();
    }
}
