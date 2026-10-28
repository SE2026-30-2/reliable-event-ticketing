package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.ConfirmReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.QrPayloadSignerPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.event.TicketIssuedEvent;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketQrClaims;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConfirmReservationApplicationServiceTest {

    @Mock
    private TicketRepositoryPort ticketRepositoryPort;
    @Mock
    private TicketTypeRepositoryPort ticketTypeRepositoryPort;
    @Mock
    private QrPayloadSignerPort qrPayloadSignerPort;
    @Mock
    private OutboxEventPublisherPort outboxEventPublisherPort;

    private ConfirmReservationApplicationService service;

    private final UUID ticketTypeId = UUID.randomUUID();
    private final UUID eventId = UUID.randomUUID();
    private final UUID reservationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ConfirmReservationApplicationService(
                ticketRepositoryPort, ticketTypeRepositoryPort, qrPayloadSignerPort, outboxEventPublisherPort);
    }

    private Ticket reservedTicket() {
        Instant now = Instant.now();
        return Ticket.builder()
                .id(1L)
                .ticketId(UUID.randomUUID())
                .ticketTypeId(ticketTypeId)
                .eventId(eventId)
                .holderName("Alice")
                .holderEmail("alice@example.com")
                .status(TicketStatus.RESERVED)
                .reservationId(reservationId)
                .reservationExpiresAt(now.plusSeconds(600))
                .validFrom(now)
                .validUntil(now.plus(1, ChronoUnit.DAYS))
                .createdAt(now)
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
    void issuesEveryReservedTicketAndMovesQuotaFromReservedToIssued() {
        Ticket t1 = reservedTicket();
        Ticket t2 = reservedTicket();
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of(t1, t2));
        when(ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(ticketTypeId)).thenReturn(Optional.of(ticketType()));
        when(qrPayloadSignerPort.sign(any(TicketQrClaims.class))).thenReturn("signed-payload");
        when(ticketRepositoryPort.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));

        service.confirmReservation(new ConfirmReservationCommand(reservationId));

        assertThat(t1.getStatus()).isEqualTo(TicketStatus.ISSUED);
        assertThat(t1.getQrPayload()).isEqualTo("signed-payload");
        assertThat(t1.getIssuedAt()).isNotNull();

        ArgumentCaptor<TicketType> typeCaptor = ArgumentCaptor.forClass(TicketType.class);
        verify(ticketTypeRepositoryPort).save(typeCaptor.capture());
        assertThat(typeCaptor.getValue().getReservedCount()).isEqualTo(0);
        assertThat(typeCaptor.getValue().getIssuedCount()).isEqualTo(4);

        verify(outboxEventPublisherPort, times(2))
                .publish(any(), org.mockito.ArgumentMatchers.eq("ticket-issued"),
                        org.mockito.ArgumentMatchers.eq("ticket-issued"), any(TicketIssuedEvent.class));
    }

    @Test
    void isANoOpWhenNoTicketsAreStillReserved() {
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of());

        service.confirmReservation(new ConfirmReservationCommand(reservationId));

        verify(ticketTypeRepositoryPort, never()).findByTicketTypeIdForUpdate(any());
        verify(ticketRepositoryPort, never()).save(any());
        verify(outboxEventPublisherPort, never()).publish(any(), any(), any(), any());
    }
}
