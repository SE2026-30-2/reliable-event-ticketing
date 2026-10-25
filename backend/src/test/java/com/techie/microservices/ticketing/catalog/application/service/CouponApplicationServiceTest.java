package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.CouponRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.ManageCouponsUseCase.CreateCouponCommand;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.CouponAlreadyExistsException;
import com.techie.microservices.ticketing.catalog.domain.exception.CouponNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidCouponException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidEventChangeException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Coupon;
import com.techie.microservices.ticketing.catalog.domain.model.CouponType;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CouponApplicationServiceTest {

    @Mock private CouponRepositoryPort coupons;
    @Mock private TicketTypeRepositoryPort types;

    private final UUID eventId = UUID.randomUUID();
    private final UUID typeId = UUID.randomUUID();

    private CouponApplicationService service() {
        return new CouponApplicationService(coupons, types);
    }

    private CreateCouponCommand create(String code, CouponType type, long value, UUID ticketTypeId) {
        return new CreateCouponCommand(eventId, code, type, value, ticketTypeId, null, null, null, "org@x.com");
    }

    @Test
    void createsAnUpperCasedActiveCoupon() {
        when(coupons.findByEventIdAndCode(eventId, "EARLY10")).thenReturn(Optional.empty());
        when(coupons.save(any(Coupon.class))).thenAnswer(inv -> inv.getArgument(0));
        Coupon c = service().createCoupon(create(" early10 ", CouponType.PERCENT, 10, null));
        assertThat(c.getCode()).isEqualTo("EARLY10");
        assertThat(c.isActive()).isTrue();
        assertThat(c.getRedeemedCount()).isZero();
    }

    @Test
    void rejectsBadCodesAndValuesAndDuplicates() {
        assertThatThrownBy(() -> service().createCoupon(create("a b", CouponType.PERCENT, 10, null))).isInstanceOf(InvalidEventChangeException.class);
        assertThatThrownBy(() -> service().createCoupon(create("OK1", CouponType.PERCENT, 101, null))).isInstanceOf(InvalidEventChangeException.class);
        assertThatThrownBy(() -> service().createCoupon(create("OK2", CouponType.FIXED, 0, null))).isInstanceOf(InvalidEventChangeException.class);
        when(coupons.findByEventIdAndCode(eventId, "DUP")).thenReturn(Optional.of(Coupon.builder().build()));
        assertThatThrownBy(() -> service().createCoupon(create("dup", CouponType.PERCENT, 5, null))).isInstanceOf(CouponAlreadyExistsException.class);
        verify(coupons, never()).save(any());
    }

    @Test
    void aTicketTypeOfAnotherEventCannotBeAttached() {
        when(types.findByTicketTypeId(typeId)).thenReturn(Optional.of(TicketType.builder().ticketTypeId(typeId).eventId(UUID.randomUUID()).build()));
        assertThatThrownBy(() -> service().createCoupon(create("GOOD", CouponType.PERCENT, 5, typeId))).isInstanceOf(TicketTypeNotFoundException.class);
    }

    @Test
    void settingActiveOnAnotherEventsCouponLooksMissing() {
        UUID couponId = UUID.randomUUID();
        when(coupons.findByCouponId(couponId)).thenReturn(Optional.of(Coupon.builder().couponId(couponId).eventId(UUID.randomUUID()).build()));
        assertThatThrownBy(() -> service().setActive(eventId, couponId, false)).isInstanceOf(CouponNotFoundException.class);
    }

    @Test
    void quoteAppliesAValidCouponAndReportsTheDiscount() {
        when(types.findByTicketTypeId(typeId)).thenReturn(Optional.of(TicketType.builder().ticketTypeId(typeId).eventId(eventId).priceCents(2_000).bundleSize(1).build()));
        when(coupons.findByEventIdAndCode(eventId, "HALF")).thenReturn(Optional.of(
                Coupon.builder().eventId(eventId).code("HALF").discountType(CouponType.PERCENT).discountValue(50).active(true).build()));
        var q = service().quote(typeId, 3, "half");
        assertThat(q.grossCents()).isEqualTo(6_000);
        assertThat(q.discountCents()).isEqualTo(3_000);
        assertThat(q.totalCents()).isEqualTo(3_000);
        assertThat(q.couponCode()).isEqualTo("HALF");
    }

    @Test
    void quoteWithAnUnknownCodeIsRejectedWithAReason() {
        when(types.findByTicketTypeId(typeId)).thenReturn(Optional.of(TicketType.builder().ticketTypeId(typeId).eventId(eventId).priceCents(2_000).bundleSize(1).build()));
        when(coupons.findByEventIdAndCode(eventId, "NOPE")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().quote(typeId, 1, "nope")).isInstanceOf(InvalidCouponException.class).hasMessageContaining("unknown");
    }
}
