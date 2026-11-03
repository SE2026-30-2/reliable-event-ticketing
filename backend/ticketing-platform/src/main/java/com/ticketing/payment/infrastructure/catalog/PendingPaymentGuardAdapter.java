package com.ticketing.payment.infrastructure.catalog;

import com.ticketing.catalog.application.port.PendingPaymentGuardPort;
import com.ticketing.payment.application.port.PaymentRequestRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PendingPaymentGuardAdapter implements PendingPaymentGuardPort {

    private final PaymentRequestRepositoryPort paymentRequestRepositoryPort;

    @Override
    public Set<UUID> reservationsWithPendingPayment(Collection<UUID> reservationIds) {
        return paymentRequestRepositoryPort.findReservationIdsWithPendingPayment(reservationIds);
    }
}
