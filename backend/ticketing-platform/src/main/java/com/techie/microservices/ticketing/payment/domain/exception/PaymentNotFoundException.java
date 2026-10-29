package com.techie.microservices.ticketing.payment.domain.exception;

public class PaymentNotFoundException extends RuntimeException {
    public PaymentNotFoundException(String what) {
        super("Payment not found: " + what);
    }
}
