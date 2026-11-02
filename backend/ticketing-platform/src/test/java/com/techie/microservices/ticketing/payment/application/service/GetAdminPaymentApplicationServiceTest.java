package com.techie.microservices.ticketing.payment.application.service;

import com.techie.microservices.ticketing.payment.application.port.PaymentRequestRepositoryPort;
import com.techie.microservices.ticketing.payment.domain.exception.PaymentNotFoundException;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class GetAdminPaymentApplicationServiceTest {
    private final PaymentRequestRepositoryPort repository = mock(PaymentRequestRepositoryPort.class);
    private final GetAdminPaymentApplicationService service = new GetAdminPaymentApplicationService(repository);

    @Test
    void globalLookupDoesNotDependOnOnlineProviderOrBuyerOwnership() {
        UUID reservation = UUID.randomUUID(), paymentId = UUID.randomUUID();
        PaymentRequest payment = PaymentRequest.builder().reservationId(reservation).paymentRequestId(paymentId).provider("FREE").build();
        when(repository.findByReservationId(reservation)).thenReturn(Optional.of(payment));
        when(repository.findByPaymentRequestId(paymentId)).thenReturn(Optional.of(payment));
        assertThat(service.getByReservation(reservation)).isSameAs(payment);
        assertThat(service.getByPaymentId(paymentId)).isSameAs(payment);
        verify(repository, never()).save(any());
    }

    @Test
    void missingIdentifiersReturnDomainNotFound() {
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> service.getByReservation(id)).isInstanceOf(PaymentNotFoundException.class);
        assertThatThrownBy(() -> service.getByPaymentId(id)).isInstanceOf(PaymentNotFoundException.class);
    }
}
