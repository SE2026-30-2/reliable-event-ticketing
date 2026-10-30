package com.techie.microservices.ticketing.catalog.web;

import com.techie.microservices.ticketing.catalog.application.port.ManageCouponsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.PriceQuote;
import com.techie.microservices.ticketing.catalog.application.port.QuoteTicketsUseCase;
import com.techie.microservices.ticketing.catalog.web.dto.CouponRequests.CouponResponse;
import com.techie.microservices.ticketing.catalog.web.dto.CouponRequests.CreateCouponRequest;
import com.techie.microservices.ticketing.catalog.web.dto.CouponRequests.SetActiveRequest;
import com.techie.microservices.ticketing.shared.web.AuthenticatedUser;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Validated
public class CouponController {

    private final ManageCouponsUseCase manageCouponsUseCase;
    private final QuoteTicketsUseCase quoteTicketsUseCase;
    private final ManagementAccess access;

    /** Public: what the buyer will pay, before reserving anything. A bad code is a 400 with the reason. */
    @GetMapping("/api/ticket-types/{ticketTypeId}/quote")
    public PriceQuote quote(@PathVariable UUID ticketTypeId,
                            @RequestParam @Min(1) @Max(10) int quantity,
                            @RequestParam(required = false) String coupon) {
        return quoteTicketsUseCase.quote(ticketTypeId, quantity, coupon);
    }

    @PostMapping("/api/manage/events/{eventId}/coupons")
    public ResponseEntity<CouponResponse> create(@PathVariable UUID eventId, @Valid @RequestBody CreateCouponRequest request,
                                                 @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        var created = manageCouponsUseCase.createCoupon(new ManageCouponsUseCase.CreateCouponCommand(
                eventId, request.code(), request.type(), request.value(), request.ticketTypeId(),
                request.maxRedemptions(), request.validFrom(), request.validUntil(), AuthenticatedUser.email(jwt)));
        return ResponseEntity.status(HttpStatus.CREATED).body(CouponResponse.from(created));
    }

    @GetMapping("/api/manage/events/{eventId}/coupons")
    public List<CouponResponse> list(@PathVariable UUID eventId, @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        return manageCouponsUseCase.listCoupons(eventId).stream().map(CouponResponse::from).toList();
    }

    @PatchMapping("/api/manage/events/{eventId}/coupons/{couponId}")
    public CouponResponse setActive(@PathVariable UUID eventId, @PathVariable UUID couponId, @Valid @RequestBody SetActiveRequest request,
                                    @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        return CouponResponse.from(manageCouponsUseCase.setActive(eventId, couponId, request.active()));
    }
}
