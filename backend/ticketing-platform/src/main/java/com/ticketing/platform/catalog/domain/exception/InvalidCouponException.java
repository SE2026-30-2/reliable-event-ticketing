package com.ticketing.platform.catalog.domain.exception;

public class InvalidCouponException extends RuntimeException {
    public InvalidCouponException(String reason) {
        super("Coupon cannot be used: " + reason);
    }
}
