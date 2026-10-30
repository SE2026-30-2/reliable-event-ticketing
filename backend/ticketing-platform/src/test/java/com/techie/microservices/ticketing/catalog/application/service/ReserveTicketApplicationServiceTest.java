package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.ReservationResult;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketCommand;
import com.techie.microservices.ticketing.catalog.domain.event.TicketReservedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeSoldOutException;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReserveTicketApplicationServiceTest {

    @Mock
    private TicketTypeRepositoryPort ticketTypeRepositoryPort;
    @Mock
    private TicketRepositoryPort ticketRepositoryPort;
    @Mock
    private com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort eventRepositoryPort;
    @Mock
    private OutboxEventPublisherPort outboxEventPublisherPort;
    @Mock
    private com.techie.microservices.ticketing.catalog.application.port.CouponRepositoryPort couponRepositoryPort;
    @Mock
    private com.techie.microservices.ticketing.catalog.application.port.WaitlistRepositoryPort waitlistRepositoryPort;

    private ReserveTicketApplicationService service;

    private final UUID ticketTypeId = UUID.randomUUID();
    private final UUID eventId = UUID.randomUUID();

    @BeforeEach
    void setUp() throws Exception {
        service = new ReserveTicketApplicationService(ticketTypeRepositoryPort, ticketRepositoryPort, outboxEventPublisherPort, eventRepositoryPort, couponRepositoryPort, waitlistRepositoryPort);
        Field field = ReserveTicketApplicationService.class.getDeclaredField("reservationExpiryMinutes");
        field.setAccessible(true);
        field.set(service, 10L);
        Field cap = ReserveTicketApplicationService.class.getDeclaredField("maxActivePerEmail");
        cap.setAccessible(true);
        cap.set(service, 10);
    }

    private TicketType ticketTypeWith(int quota, int issuedCount, int reservedCount) {
        Instant now = Instant.now();
        return TicketType.builder()
                .id(1L)
                .ticketTypeId(ticketTypeId)
                .eventId(eventId)
                .name("General Admission")
                .priceCents(1000)
                .quota(quota)
                .issuedCount(issuedCount)
                .reservedCount(reservedCount)
                .validFrom(now)
                .validUntil(now.plus(1, ChronoUnit.DAYS))
                .createdAt(now)
                .build();
    }

    private void openEvent() {
        Instant now = Instant.now();
        when(eventRepositoryPort.findByEventId(eventId)).thenReturn(Optional.of(
                com.techie.microservices.ticketing.catalog.domain.model.Event.builder().eventId(eventId).name("E")
                        .startsAt(now.plusSeconds(3600)).endsAt(now.plusSeconds(7200))
                        .status(com.techie.microservices.ticketing.catalog.domain.model.EventStatus.PUBLISHED).build()));
    }

    @Test
    void refusesToSellForADraftOrOverEvent() {
        Instant now = Instant.now();
        when(ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)).thenReturn(Optional.of(ticketTypeWith(10, 0, 0)));
        when(eventRepositoryPort.findByEventId(eventId)).thenReturn(Optional.of(
                com.techie.microservices.ticketing.catalog.domain.model.Event.builder().eventId(eventId).name("E")
                        .startsAt(now.plusSeconds(3600)).endsAt(now.plusSeconds(7200))
                        .status(com.techie.microservices.ticketing.catalog.domain.model.EventStatus.DRAFT).build()));

        assertThatThrownBy(() -> service.reserveTickets(new ReserveTicketCommand("o@example.com", ticketTypeId, 1, "A", "a@example.com")))
                .isInstanceOf(com.techie.microservices.ticketing.catalog.domain.exception.EventNotOpenException.class);
        verify(ticketTypeRepositoryPort, never()).save(any());
    }

    @Test
    void reservesRequestedQuantityAndIncrementsReservedCount() {
        openEvent();
        TicketType ticketType = ticketTypeWith(10, 3, 1);
        when(ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)).thenReturn(Optional.of(ticketType));
        when(ticketRepositoryPort.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));

        ReservationResult result = service.reserveTickets(new ReserveTicketCommand("owner@example.com", ticketTypeId, 2, "Alice", "alice@example.com"));

        assertThat(result.reservationId()).isNotNull();
        assertThat(result.tickets()).hasSize(2);
        assertThat(result.tickets()).allSatisfy(ticket -> {
            assertThat(ticket.getStatus()).isEqualTo(TicketStatus.RESERVED);
            assertThat(ticket.getReservationId()).isEqualTo(result.reservationId());
            assertThat(ticket.getReservationExpiresAt()).isNotNull();
            assertThat(ticket.getQrPayload()).isNull();
            assertThat(ticket.getOwnerEmail()).isEqualTo("owner@example.com");
            assertThat(ticket.getIssuedAt()).isNull();
        });
        assertThat(result.tickets().get(0).getTicketId()).isNotEqualTo(result.tickets().get(1).getTicketId());

        ArgumentCaptor<TicketType> savedTypeCaptor = ArgumentCaptor.forClass(TicketType.class);
        verify(ticketTypeRepositoryPort).save(savedTypeCaptor.capture());
        assertThat(savedTypeCaptor.getValue().getReservedCount()).isEqualTo(3);
        assertThat(savedTypeCaptor.getValue().getIssuedCount()).isEqualTo(3);

        verify(outboxEventPublisherPort, times(2))
                .publish(any(), org.mockito.ArgumentMatchers.eq("ticket-reserved"),
                        org.mockito.ArgumentMatchers.eq("ticket-reserved"), any(TicketReservedEvent.class));
    }

    @Test
    void rejectsRequestExceedingRemainingQuotaCountingBothIssuedAndReserved() {
        openEvent();
        TicketType ticketType = ticketTypeWith(5, 3, 1);
        when(ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)).thenReturn(Optional.of(ticketType));

        assertThatThrownBy(() -> service.reserveTickets(new ReserveTicketCommand("owner@example.com", ticketTypeId, 2, "Bob", "bob@example.com")))
                .isInstanceOf(TicketTypeSoldOutException.class)
                .hasMessageContaining("only 1 remaining");

        verify(ticketRepositoryPort).countActiveReservationsByOwner("owner@example.com"); // the cap check itself
        verifyNoMoreInteractions(ticketRepositoryPort, outboxEventPublisherPort);
    }

    @Test
    void refusesToHoldMoreThanTheCapForOneEmailWithoutTouchingTheTicketTypeLock() {
        when(ticketRepositoryPort.countActiveReservationsByOwner("hoarder@example.com")).thenReturn(9L);

        assertThatThrownBy(() -> service.reserveTickets(new ReserveTicketCommand("Hoarder@Example.com", ticketTypeId, 2, "H", "someone-else@example.com")))
                .isInstanceOf(com.techie.microservices.ticketing.catalog.domain.exception.TooManyActiveReservationsException.class);

        verify(ticketTypeRepositoryPort, never()).findByTicketTypeIdForUpdate(any()); // the lock is never taken
        verifyNoMoreInteractions(outboxEventPublisherPort);
    }

    @Test
    void aBundleCreatesBundleSizeTicketsPerUnitWithTheUnitPriceSplitAcrossThem() {
        openEvent();
        TicketType type = ticketTypeWith(20, 0, 0);
        type.setBundleSize(4);
        type.setPriceCents(1_001);
        when(ticketTypeRepositoryPort.findByTicketTypeId(ticketTypeId)).thenReturn(Optional.of(type));
        when(ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)).thenReturn(Optional.of(type));
        when(ticketRepositoryPort.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));

        ReservationResult result = service.reserveTickets(new ReserveTicketCommand("o@example.com", ticketTypeId, 2, "A", "a@example.com"));

        assertThat(result.tickets()).hasSize(8); // 2 units x 4
        assertThat(result.totalCents()).isEqualTo(2_002);
        assertThat(result.tickets().stream().mapToLong(Ticket::getPriceCents).sum()).isEqualTo(2_002);
        assertThat(type.getReservedCount()).isEqualTo(8); // quota counts tickets, not units
    }

    @Test
    void aCouponDiscountsEveryTicketAndConsumesOneRedemptionPerReservation() {
        openEvent();
        TicketType type = ticketTypeWith(10, 0, 0);
        when(ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)).thenReturn(Optional.of(type));
        when(ticketRepositoryPort.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
        com.techie.microservices.ticketing.catalog.domain.model.Coupon coupon = com.techie.microservices.ticketing.catalog.domain.model.Coupon.builder()
                .couponId(UUID.randomUUID()).eventId(eventId).code("HALF").active(true).maxRedemptions(1).redeemedCount(0)
                .discountType(com.techie.microservices.ticketing.catalog.domain.model.CouponType.PERCENT).discountValue(50).build();
        when(couponRepositoryPort.findByEventIdAndCodeForUpdate(eventId, "HALF")).thenReturn(Optional.of(coupon));

        ReservationResult result = service.reserveTickets(new ReserveTicketCommand("o@example.com", ticketTypeId, 2, "A", "a@example.com", "half"));

        assertThat(result.totalCents()).isEqualTo(1_000); // 2 x (1000 - 500)
        assertThat(result.discountCents()).isEqualTo(1_000);
        assertThat(result.tickets()).allSatisfy(t -> {
            assertThat(t.getPriceCents()).isEqualTo(500);
            assertThat(t.getCouponId()).isEqualTo(coupon.getCouponId());
        });
        assertThat(coupon.getRedeemedCount()).isEqualTo(1);
        verify(couponRepositoryPort).save(coupon);
    }

    @Test
    void aFullyRedeemedCouponStopsTheReservationBeforeAnythingIsHeld() {
        openEvent();
        when(ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)).thenReturn(Optional.of(ticketTypeWith(10, 0, 0)));
        when(couponRepositoryPort.findByEventIdAndCodeForUpdate(eventId, "GONE")).thenReturn(Optional.of(
                com.techie.microservices.ticketing.catalog.domain.model.Coupon.builder().eventId(eventId).code("GONE").active(true)
                        .maxRedemptions(1).redeemedCount(1)
                        .discountType(com.techie.microservices.ticketing.catalog.domain.model.CouponType.PERCENT).discountValue(10).build()));

        assertThatThrownBy(() -> service.reserveTickets(new ReserveTicketCommand("o@example.com", ticketTypeId, 1, "A", "a@example.com", "gone")))
                .isInstanceOf(com.techie.microservices.ticketing.catalog.domain.exception.InvalidCouponException.class);
        verify(ticketRepositoryPort, never()).save(any(Ticket.class));
        verify(ticketTypeRepositoryPort, never()).save(any());
    }
}
