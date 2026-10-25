package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.CancelReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CancelReservationApplicationServiceTest {

    @Mock
    private TicketRepositoryPort ticketRepositoryPort;
    @Mock
    private TicketTypeRepositoryPort ticketTypeRepositoryPort;
    @Mock
    private com.techie.microservices.ticketing.catalog.application.port.CouponRepositoryPort couponRepositoryPort;

    private CancelReservationApplicationService service;

    private final UUID ticketTypeId = UUID.randomUUID();
    private final UUID eventId = UUID.randomUUID();
    private final UUID reservationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new CancelReservationApplicationService(ticketRepositoryPort, ticketTypeRepositoryPort, couponRepositoryPort);
    }

    private Ticket reservedTicket() {
        Instant now = Instant.now();
        return Ticket.builder()
                .id(1L).ticketId(UUID.randomUUID()).ticketTypeId(ticketTypeId).eventId(eventId)
                .status(TicketStatus.RESERVED).reservationId(reservationId)
                .reservationExpiresAt(now.plusSeconds(600))
                .validFrom(now).validUntil(now.plus(1, ChronoUnit.DAYS)).createdAt(now)
                .build();
    }

    private TicketType ticketType() {
        return TicketType.builder()
                .id(1L).ticketTypeId(ticketTypeId).eventId(eventId)
                .quota(10).issuedCount(2).reservedCount(2)
                .validFrom(Instant.now()).validUntil(Instant.now().plus(1, ChronoUnit.DAYS))
                .build();
    }

    @Test
    void cancelsEveryReservedTicketAndReleasesReservedCountWithoutTouchingIssuedCount() {
        Ticket ticket = reservedTicket();
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of(ticket));
        when(ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)).thenReturn(Optional.of(ticketType()));

        service.cancelReservation(new CancelReservationCommand(reservationId, "payment failed: declined"));

        assertThat(ticket.getStatus()).isEqualTo(TicketStatus.CANCELLED);
        assertThat(ticket.getStatusReason()).isEqualTo("payment failed: declined");
        verify(ticketRepositoryPort).save(ticket);

        ArgumentCaptor<TicketType> typeCaptor = ArgumentCaptor.forClass(TicketType.class);
        verify(ticketTypeRepositoryPort).save(typeCaptor.capture());
        assertThat(typeCaptor.getValue().getReservedCount()).isEqualTo(1);
        assertThat(typeCaptor.getValue().getIssuedCount()).isEqualTo(2);
    }

    @Test
    void isANoOpWhenNoTicketsAreStillReserved() {
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of());

        service.cancelReservation(new CancelReservationCommand(reservationId, "reservation expired"));

        verify(ticketTypeRepositoryPort, never()).findByTicketTypeIdForUpdate(any());
        verify(ticketRepositoryPort, never()).save(any());
    }

    @Test
    void cancellingAReservationThatUsedACouponGivesTheRedemptionBack() {
        UUID couponId = UUID.randomUUID();
        Ticket t = reservedTicket();
        t.setCouponId(couponId);
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of(t, t));
        when(ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)).thenReturn(Optional.of(ticketType()));
        com.techie.microservices.ticketing.catalog.domain.model.Coupon coupon = com.techie.microservices.ticketing.catalog.domain.model.Coupon.builder()
                .couponId(couponId).redeemedCount(3).build();
        when(couponRepositoryPort.findByCouponIdForUpdate(couponId)).thenReturn(Optional.of(coupon));

        service.cancelReservation(new CancelReservationCommand(reservationId, "reservation expired"));

        assertThat(coupon.getRedeemedCount()).isEqualTo(2); // once per reservation, not once per ticket
        verify(couponRepositoryPort).save(coupon);
    }
}
