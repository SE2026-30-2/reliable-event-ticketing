package com.techie.microservices.ticketing.catalog.domain.exception;

public class CouponAlreadyExistsException extends RuntimeException {
    public CouponAlreadyExistsException(String code) {
        super("A coupon with code " + code + " already exists for this event");
    }
}
