package com.ticketing.payment.web;

import com.ticketing.payment.application.port.GetAdminPaymentUseCase;
import com.ticketing.payment.web.dto.PaymentRequestResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.UUID;

/** Global lookups require ROLE_ADMIN in SecurityConfig; buyer endpoints retain ownership checks. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/payments")
public class AdminPaymentController {
    private final GetAdminPaymentUseCase payments;

    @GetMapping("/by-reservation/{reservationId}")
    public PaymentRequestResponse byReservation(@PathVariable UUID reservationId) {
        return PaymentRequestResponse.from(payments.getByReservation(reservationId));
    }

    @GetMapping("/{paymentRequestId}")
    public PaymentRequestResponse byPaymentId(@PathVariable UUID paymentRequestId) {
        return PaymentRequestResponse.from(payments.getByPaymentId(paymentRequestId));
    }
}
