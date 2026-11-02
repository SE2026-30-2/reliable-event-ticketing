package com.techie.microservices.ticketing.payment.application.port;

import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import java.util.UUID;

/** Administrative reads are exposed only through the ADMIN-protected controller. */
public interface GetAdminPaymentUseCase {
    PaymentRequest getByReservation(UUID reservationId);
    PaymentRequest getByPaymentId(UUID paymentRequestId);
}
