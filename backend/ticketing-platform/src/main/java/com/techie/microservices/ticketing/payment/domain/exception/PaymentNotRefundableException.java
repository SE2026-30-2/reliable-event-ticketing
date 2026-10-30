package com.techie.microservices.ticketing.payment.domain.exception;

public class PaymentNotRefundableException extends RuntimeException {
    public PaymentNotRefundableException(String message) {
        super(message);
    }
}
