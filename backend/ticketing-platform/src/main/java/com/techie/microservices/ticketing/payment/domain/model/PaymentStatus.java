package com.techie.microservices.ticketing.payment.domain.model;

public enum PaymentStatus {
    /** Waiting for the provider's verdict (hosted payment page opened, IPN not yet received). */
    PENDING,
    COMPLETED,
    FAILED,
    /** The provider took the money but the reservation could no longer be honoured - must be refunded. */
    REFUND_REQUIRED,
    REFUNDED
}
