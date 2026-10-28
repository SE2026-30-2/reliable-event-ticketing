package com.techie.microservices.ticketing.catalog.domain.exception;

public class InvalidCouponException extends RuntimeException {
    public InvalidCouponException(String reason) {
        super("Coupon cannot be used: " + reason);
    }
}
