package com.ticketing.catalog.domain.exception;

public class CouponNotFoundException extends RuntimeException {
    public CouponNotFoundException(String what) {
        super("Coupon not found: " + what);
    }
}
