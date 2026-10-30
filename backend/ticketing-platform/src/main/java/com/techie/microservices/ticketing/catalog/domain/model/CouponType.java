package com.techie.microservices.ticketing.catalog.domain.model;

public enum CouponType {
    /** discountValue is a percentage, 1..100. */
    PERCENT,
    /** discountValue is an amount in cents taken off each ticket unit (never below zero). */
    FIXED
}
