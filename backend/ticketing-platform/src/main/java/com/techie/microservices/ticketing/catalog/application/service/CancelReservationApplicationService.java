package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.CancelReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.CancelReservationUseCase;
import com.techie.microservices.ticketing.catalog.application.port.CouponRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Resolves a reservation on payment failure (or, via {@code ExpireReservationsJob}, on reservation
 * timeout - same outcome, different trigger and {@code reason} text): every ticket still
 * RESERVED in the group transitions to {@link TicketStatus#CANCELLED} and its held quota is
 * released from {@code reservedCount} - NOT added to {@code issuedCount}, since no ticket was ever
 * actually issued.
 * <p>
 * Idempotent by construction, same reasoning as {@link ConfirmReservationApplicationService}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CancelReservationApplicationService implements CancelReservationUseCase {

    private final TicketRepositoryPort ticketRepositoryPort;
    private final TicketTypeRepositoryPort ticketTypeRepositoryPort;
    private final CouponRepositoryPort couponRepositoryPort;

    @Override
    public void cancelReservation(CancelReservationCommand command) {
        List<Ticket> reservedTickets = ticketRepositoryPort.findByReservationId(command.reservationId()).stream()
                .filter(ticket -> ticket.getStatus() == TicketStatus.RESERVED)
                .toList();
        if (reservedTickets.isEmpty()) {
            log.info("Reservation {} has no tickets still RESERVED - already resolved or unknown, ignoring",
                    command.reservationId());
            return;
        }

        UUID ticketTypeId = reservedTickets.get(0).getTicketTypeId();
        TicketType ticketType = ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)
                .orElseThrow(() -> new TicketTypeNotFoundException(ticketTypeId));

        for (Ticket ticket : reservedTickets) {
            ticket.setStatus(TicketStatus.CANCELLED);
            ticket.setStatusReason(command.reason());
            ticketRepositoryPort.save(ticket);
        }

        ticketType.setReservedCount(ticketType.getReservedCount() - reservedTickets.size());
        ticketTypeRepositoryPort.save(ticketType);

        // A redemption is held per reservation; giving the reservation up gives the redemption back.
        UUID couponId = reservedTickets.get(0).getCouponId();
        if (couponId != null) {
            couponRepositoryPort.findByCouponIdForUpdate(couponId).ifPresent(coupon -> {
                coupon.setRedeemedCount(Math.max(0, coupon.getRedeemedCount() - 1));
                couponRepositoryPort.save(coupon);
            });
        }

        log.info("Cancelled reservation {} ({} ticket(s)): {}",
                command.reservationId(), reservedTickets.size(), command.reason());
    }
}
