package com.ticketing.platform.payment.domain.exception;

public class PaymentNotFoundException extends RuntimeException {
    public PaymentNotFoundException(String what) {
        super("Payment not found: " + what);
    }
}
