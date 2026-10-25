package com.techie.microservices.ticketing.payment.infrastructure.catalog;

import com.techie.microservices.ticketing.catalog.application.port.GetReservationPaymentUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ReservationPayment;
import com.techie.microservices.ticketing.payment.application.port.ReservationPricingPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CatalogReservationPricingAdapter implements ReservationPricingPort {

    private final GetReservationPaymentUseCase getReservationPaymentUseCase;

    @Override
    public Quote quote(UUID reservationId, String requesterEmail) {
        ReservationPayment p = getReservationPaymentUseCase.getPayableReservation(reservationId, requesterEmail);
        return new Quote(p.amountCents(), p.expiresAt());
    }

    @Override
    public void assertOwnedBy(UUID reservationId, String requesterEmail) {
        getReservationPaymentUseCase.assertReservationOwnedBy(reservationId, requesterEmail);
    }

    @Override
    public boolean isStillHeld(UUID reservationId) {
        return getReservationPaymentUseCase.isPayable(reservationId);
    }
}
