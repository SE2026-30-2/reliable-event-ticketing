package com.techie.microservices.ticketing.catalog.infrastructure.scheduling;

import com.techie.microservices.ticketing.catalog.application.port.CancelReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.CancelReservationUseCase;
import com.techie.microservices.ticketing.catalog.application.port.PendingPaymentGuardPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpireReservationsJobTest {

    @Mock
    private TicketRepositoryPort tickets;
    @Mock
    private CancelReservationUseCase cancel;
    @Mock
    private PendingPaymentGuardPort guard;

    @Test
    void cancelsExpiredReservationsExceptThoseWithAPaymentStillPending() {
        UUID abandoned = UUID.randomUUID();
        UUID paying = UUID.randomUUID();
        when(tickets.findExpiredReservations(any(Instant.class))).thenReturn(List.of(
                Ticket.builder().reservationId(abandoned).build(), Ticket.builder().reservationId(paying).build()));
        when(guard.reservationsWithPendingPayment(any())).thenReturn(Set.of(paying));

        new ExpireReservationsJob(tickets, cancel, guard).expireStaleReservations();

        verify(cancel).cancelReservation(new CancelReservationCommand(abandoned, "reservation expired"));
        verify(cancel, never()).cancelReservation(new CancelReservationCommand(paying, "reservation expired"));
    }
}
