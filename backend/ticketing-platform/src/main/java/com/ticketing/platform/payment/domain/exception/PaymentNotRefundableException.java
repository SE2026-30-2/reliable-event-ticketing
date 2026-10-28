package com.ticketing.platform.payment.domain.exception;

public class PaymentNotRefundableException extends RuntimeException {
    public PaymentNotRefundableException(String message) {
        super(message);
    }
}
