package com.techie.microservices.ticketing.payment.web.dto;

import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;

import java.time.Instant;
import java.util.UUID;

public record PaymentRequestResponse(
        UUID paymentRequestId,
        UUID reservationId,
        long amountCents,
        String status,
        Instant createdAt,
        Instant completedAt,
        String provider,
        /** Online providers only: reference to poll/sync by after returning from the hosted page. */
        String txnRef,
        /** Present while the hosted payment is still open: send the buyer here. */
        String paymentUrl,
        String failureReason
) {
    public static PaymentRequestResponse from(PaymentRequest p) {
        return new PaymentRequestResponse(p.getPaymentRequestId(), p.getReservationId(), p.getAmountCents(),
                p.getStatus().name(), p.getCreatedAt(), p.getCompletedAt(), p.getProvider(), p.getTxnRef(),
                p.getPaymentUrl(), p.getFailureReason());
    }
}
