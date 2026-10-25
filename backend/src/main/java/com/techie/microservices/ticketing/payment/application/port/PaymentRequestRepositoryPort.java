package com.techie.microservices.ticketing.payment.application.port;

import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface PaymentRequestRepositoryPort {
    PaymentRequest save(PaymentRequest paymentRequest);

    Optional<PaymentRequest> findByReservationId(UUID reservationId);

    Optional<PaymentRequest> findByTxnRef(String txnRef);

    Optional<PaymentRequest> findByPaymentRequestId(UUID paymentRequestId);

    List<PaymentRequest> findByStatusAndProvider(PaymentStatus status, String provider);

    /** Which of these reservations still have a payment awaiting the provider's verdict. */
    Set<UUID> findReservationIdsWithPendingPayment(Collection<UUID> reservationIds);
}
