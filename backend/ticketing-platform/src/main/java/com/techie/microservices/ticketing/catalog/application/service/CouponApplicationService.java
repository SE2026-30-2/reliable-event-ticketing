package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.CouponRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.ManageCouponsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.PriceQuote;
import com.techie.microservices.ticketing.catalog.application.port.QuoteTicketsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.CouponAlreadyExistsException;
import com.techie.microservices.ticketing.catalog.domain.exception.CouponNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidCouponException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidEventChangeException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Coupon;
import com.techie.microservices.ticketing.catalog.domain.model.CouponType;
import com.techie.microservices.ticketing.catalog.domain.model.PriceCalculator;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional
public class CouponApplicationService implements ManageCouponsUseCase, QuoteTicketsUseCase {

    private static final Pattern CODE = Pattern.compile("[A-Z0-9_-]{3,40}");

    private final CouponRepositoryPort couponRepositoryPort;
    private final TicketTypeRepositoryPort ticketTypeRepositoryPort;

    @Override
    public Coupon createCoupon(CreateCouponCommand c) {
        String code = c.code() == null ? "" : c.code().trim().toUpperCase(Locale.ROOT);
        if (!CODE.matcher(code).matches()) {
            throw new InvalidEventChangeException("Coupon code must be 3-40 letters, digits, '-' or '_'");
        }
        if (c.type() == CouponType.PERCENT && (c.value() < 1 || c.value() > 100)) {
            throw new InvalidEventChangeException("A percentage coupon must be between 1 and 100");
        }
        if (c.type() == CouponType.FIXED && c.value() < 1) {
            throw new InvalidEventChangeException("A fixed coupon must take off at least 1");
        }
        if (c.maxRedemptions() != null && c.maxRedemptions() < 1) {
            throw new InvalidEventChangeException("maxRedemptions must be at least 1 when set");
        }
        if (c.validFrom() != null && c.validUntil() != null && !c.validUntil().isAfter(c.validFrom())) {
            throw new InvalidEventChangeException("validUntil must be after validFrom");
        }
        if (c.ticketTypeId() != null) {
            TicketType type = ticketTypeRepositoryPort.findByTicketTypeId(c.ticketTypeId())
                    .orElseThrow(() -> new TicketTypeNotFoundException(c.ticketTypeId()));
            if (!type.getEventId().equals(c.eventId())) {
                throw new TicketTypeNotFoundException(c.ticketTypeId()); // another event's ticket type looks missing
            }
        }
        if (couponRepositoryPort.findByEventIdAndCode(c.eventId(), code).isPresent()) {
            throw new CouponAlreadyExistsException(code);
        }
        return couponRepositoryPort.save(Coupon.builder()
                .couponId(UUID.randomUUID()).eventId(c.eventId()).code(code).discountType(c.type()).discountValue(c.value())
                .ticketTypeId(c.ticketTypeId()).maxRedemptions(c.maxRedemptions()).validFrom(c.validFrom()).validUntil(c.validUntil())
                .active(true).createdBy(c.createdBy()).createdAt(Instant.now()).build());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Coupon> listCoupons(UUID eventId) {
        return couponRepositoryPort.findByEventId(eventId);
    }

    @Override
    public Coupon setActive(UUID eventId, UUID couponId, boolean active) {
        Coupon coupon = couponRepositoryPort.findByCouponId(couponId)
                .filter(found -> found.getEventId().equals(eventId))
                .orElseThrow(() -> new CouponNotFoundException(couponId.toString()));
        coupon.setActive(active);
        return couponRepositoryPort.save(coupon);
    }

    @Override
    @Transactional(readOnly = true)
    public PriceQuote quote(UUID ticketTypeId, int quantity, String couponCode) {
        TicketType type = ticketTypeRepositoryPort.findByTicketTypeId(ticketTypeId)
                .orElseThrow(() -> new TicketTypeNotFoundException(ticketTypeId));
        Coupon coupon = null;
        String applied = null;
        if (couponCode != null && !couponCode.isBlank()) {
            coupon = couponRepositoryPort.findByEventIdAndCode(type.getEventId(), couponCode.trim().toUpperCase(Locale.ROOT))
                    .orElseThrow(() -> new InvalidCouponException("unknown code"));
            coupon.assertUsableFor(type, Instant.now());
            applied = coupon.getCode();
        }
        PriceCalculator.Result price = PriceCalculator.price(type.getPriceCents(), type.getBundleSize(), quantity, coupon);
        return new PriceQuote(type.getPriceCents(), price.ticketCount(), price.grossCents(), price.discountCents(), price.totalCents(), applied);
    }
}
