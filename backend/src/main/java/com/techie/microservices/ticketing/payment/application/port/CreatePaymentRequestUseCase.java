package com.techie.microservices.ticketing.payment.application.port;

import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;

public interface CreatePaymentRequestUseCase {
    /** Idempotent on {@code reservationId}: a repeated call for a reservation that already has a
     * payment request returns that existing outcome instead of charging a second time. */
    PaymentRequest createPaymentRequest(CreatePaymentRequestCommand command);
}
