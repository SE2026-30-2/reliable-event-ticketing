package com.ticketing.platform.catalog.domain.exception;

public class CouponNotFoundException extends RuntimeException {
    public CouponNotFoundException(String what) {
        super("Coupon not found: " + what);
    }
}
