package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpringDataCouponJpaRepository extends JpaRepository<CouponEntity, Long> {
    Optional<CouponEntity> findByCouponId(UUID couponId);

    Optional<CouponEntity> findByEventIdAndCode(UUID eventId, String code);

    List<CouponEntity> findByEventIdOrderByCreatedAtDesc(UUID eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM CouponEntity c WHERE c.eventId = :eventId AND c.code = :code")
    Optional<CouponEntity> findByEventIdAndCodeForUpdate(@Param("eventId") UUID eventId, @Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM CouponEntity c WHERE c.couponId = :couponId")
    Optional<CouponEntity> findByCouponIdForUpdate(@Param("couponId") UUID couponId);
}
