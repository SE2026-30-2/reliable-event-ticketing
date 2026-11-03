package com.ticketing.payment.application.service;

import com.ticketing.payment.application.port.GetAdminPaymentUseCase;
import com.ticketing.payment.application.port.PaymentRequestRepositoryPort;
import com.ticketing.payment.domain.exception.PaymentNotFoundException;
import com.ticketing.payment.domain.model.PaymentRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

/** Available for every provider, including FREE/MOCK when online payments are disabled. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetAdminPaymentApplicationService implements GetAdminPaymentUseCase {
    private final PaymentRequestRepositoryPort repository;

    @Override
    public PaymentRequest getByReservation(UUID reservationId) {
        return repository.findByReservationId(reservationId)
                .orElseThrow(() -> new PaymentNotFoundException(reservationId.toString()));
    }

    @Override
    public PaymentRequest getByPaymentId(UUID paymentRequestId) {
        return repository.findByPaymentRequestId(paymentRequestId)
                .orElseThrow(() -> new PaymentNotFoundException(paymentRequestId.toString()));
    }
}
