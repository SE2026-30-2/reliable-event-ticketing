package com.techie.microservices.ticketing.catalog.infrastructure.scheduling;

import com.techie.microservices.ticketing.catalog.application.port.CancelReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.CancelReservationUseCase;
import com.techie.microservices.ticketing.catalog.application.port.PendingPaymentGuardPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Sweeps RESERVED tickets whose reservation window lapsed with no payment outcome ever arriving
 * (an abandoned checkout) and cancels them, releasing their held quota - the exact same {@link
 * CancelReservationUseCase} a payment-failed event triggers, just fired by a clock instead of a
 * message, with a reason string that says so.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ExpireReservationsJob {

    private final TicketRepositoryPort ticketRepositoryPort;
    private final CancelReservationUseCase cancelReservationUseCase;
    private final PendingPaymentGuardPort pendingPaymentGuardPort;

    @Scheduled(fixedDelay = 60_000)
    public void expireStaleReservations() {
        List<Ticket> expired = ticketRepositoryPort.findExpiredReservations(Instant.now());
        if (expired.isEmpty()) {
            return;
        }
        Set<UUID> reservationIds = expired.stream().map(Ticket::getReservationId).collect(Collectors.toSet());
        // A payment still being decided by the provider owns the reservation's fate: the payment
        // module resolves it (confirm, or fail after reconciling), so cancelling here could race a
        // confirmation and leave the buyer charged with no ticket.
        reservationIds.removeAll(pendingPaymentGuardPort.reservationsWithPendingPayment(reservationIds));
        for (UUID reservationId : reservationIds) {
            cancelReservationUseCase.cancelReservation(new CancelReservationCommand(reservationId, "reservation expired"));
        }
        log.info("Expired {} stale reservation(s) ({} ticket(s))", reservationIds.size(), expired.size());
    }
}
