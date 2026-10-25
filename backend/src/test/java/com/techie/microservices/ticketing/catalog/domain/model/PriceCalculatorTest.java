package com.techie.microservices.ticketing.catalog.domain.model;

import com.techie.microservices.ticketing.catalog.domain.exception.InvalidCouponException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PriceCalculatorTest {

    private static Coupon coupon(CouponType type, long value) {
        return Coupon.builder().couponId(UUID.randomUUID()).eventId(UUID.randomUUID()).code("X").discountType(type)
                .discountValue(value).active(true).build();
    }

    @Test
    void withoutACouponItIsPriceTimesQuantity() {
        var r = PriceCalculator.price(2_500_000, 1, 3, null);
        assertThat(r.grossCents()).isEqualTo(7_500_000);
        assertThat(r.discountCents()).isZero();
        assertThat(r.totalCents()).isEqualTo(7_500_000);
        assertThat(r.perTicketCents()).containsExactly(2_500_000L, 2_500_000L, 2_500_000L);
    }

    @Test
    void percentDiscountRoundsDownPerUnitLeavingNoCentsUnaccounted() {
        var r = PriceCalculator.price(999, 1, 2, coupon(CouponType.PERCENT, 10)); // 99.9 -> 99 off each
        assertThat(r.discountCents()).isEqualTo(198);
        assertThat(r.totalCents()).isEqualTo(2 * (999 - 99));
        assertThat(r.grossCents() - r.discountCents()).isEqualTo(r.totalCents());
    }

    @Test
    void fixedDiscountIsPerUnitAndNeverTakesMoreThanThePrice() {
        var r = PriceCalculator.price(500, 1, 2, coupon(CouponType.FIXED, 800));
        assertThat(r.totalCents()).isZero();
        assertThat(r.perTicketCents()).containsExactly(0L, 0L);
    }

    @Test
    void aBundleSplitsItsUnitPriceAcrossItsTicketsToTheExactCent() {
        var r = PriceCalculator.price(1_000, 3, 2, null); // 1000 / 3 = 333 remainder 1
        assertThat(r.ticketCount()).isEqualTo(6);
        assertThat(r.perTicketCents()).containsExactly(334L, 333L, 333L, 334L, 333L, 333L);
        assertThat(r.perTicketCents().stream().mapToLong(Long::longValue).sum()).isEqualTo(r.totalCents()).isEqualTo(2_000);
    }

    @Test
    void aCouponAppliesToTheWholeBundleUnit() {
        var r = PriceCalculator.price(1_000, 4, 1, coupon(CouponType.PERCENT, 50));
        assertThat(r.totalCents()).isEqualTo(500);
        assertThat(r.perTicketCents()).containsExactly(125L, 125L, 125L, 125L);
    }

    @Test
    void couponValidityRules() {
        UUID eventId = UUID.randomUUID();
        TicketType type = TicketType.builder().ticketTypeId(UUID.randomUUID()).eventId(eventId).build();
        Instant now = Instant.now();
        Coupon.builder().eventId(eventId).code("OK").discountType(CouponType.PERCENT).discountValue(10).active(true).build()
                .assertUsableFor(type, now); // no exception

        assertThatThrownBy(() -> Coupon.builder().eventId(eventId).discountType(CouponType.PERCENT).active(false).build().assertUsableFor(type, now))
                .isInstanceOf(InvalidCouponException.class).hasMessageContaining("active");
        assertThatThrownBy(() -> Coupon.builder().eventId(UUID.randomUUID()).discountType(CouponType.PERCENT).active(true).build().assertUsableFor(type, now))
                .isInstanceOf(InvalidCouponException.class).hasMessageContaining("apply");
        assertThatThrownBy(() -> Coupon.builder().eventId(eventId).ticketTypeId(UUID.randomUUID()).active(true).build().assertUsableFor(type, now))
                .isInstanceOf(InvalidCouponException.class);
        assertThatThrownBy(() -> Coupon.builder().eventId(eventId).active(true).validUntil(now.minusSeconds(1)).build().assertUsableFor(type, now))
                .isInstanceOf(InvalidCouponException.class).hasMessageContaining("expired");
        assertThatThrownBy(() -> Coupon.builder().eventId(eventId).active(true).validFrom(now.plusSeconds(60)).build().assertUsableFor(type, now))
                .isInstanceOf(InvalidCouponException.class).hasMessageContaining("yet");
        assertThatThrownBy(() -> Coupon.builder().eventId(eventId).active(true).maxRedemptions(5).redeemedCount(5).build().assertUsableFor(type, now))
                .isInstanceOf(InvalidCouponException.class).hasMessageContaining("redeemed");
    }
}
