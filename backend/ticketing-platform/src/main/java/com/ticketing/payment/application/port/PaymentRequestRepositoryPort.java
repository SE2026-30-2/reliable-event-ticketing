package com.ticketing.payment.application.port;

import com.ticketing.payment.domain.model.PaymentRequest;
import com.ticketing.payment.domain.model.PaymentStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface PaymentRequestRepositoryPort {
    PaymentRequest save(PaymentRequest paymentRequest);

    /**
     * Persist a settlement only while the stored payment is still PENDING.
     *
     * @return true if this call changed the pending row, false if another transition already won
     */
    boolean saveIfPending(PaymentRequest paymentRequest);

    Optional<PaymentRequest> findByReservationId(UUID reservationId);

    Optional<PaymentRequest> findByTxnRef(String txnRef);

    Optional<PaymentRequest> findByPaymentRequestId(UUID paymentRequestId);

    List<PaymentRequest> findByStatusAndProvider(PaymentStatus status, String provider);

    /** Which of these reservations still have a payment awaiting the provider's verdict. */
    Set<UUID> findReservationIdsWithPendingPayment(Collection<UUID> reservationIds);
}
