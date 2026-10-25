package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.event.TicketVoidedEvent;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefundReservationApplicationServiceTest {

    @Mock
    private TicketRepositoryPort ticketRepositoryPort;
    @Mock
    private OutboxEventPublisherPort outbox;

    private Ticket ticket(TicketStatus status) {
        return Ticket.builder().ticketId(UUID.randomUUID()).eventId(UUID.randomUUID()).status(status).build();
    }

    @Test
    void refundsIssuedTicketsAndPublishesVoidedEventsButSkipsOthers() {
        UUID reservationId = UUID.randomUUID();
        Ticket issued1 = ticket(TicketStatus.ISSUED);
        Ticket issued2 = ticket(TicketStatus.ISSUED);
        Ticket alreadyVoid = ticket(TicketStatus.VOID);
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of(issued1, issued2, alreadyVoid));

        new RefundReservationApplicationService(ticketRepositoryPort, outbox).refundReservation(reservationId);

        assertThat(issued1.getStatus()).isEqualTo(TicketStatus.REFUNDED);
        assertThat(issued2.getStatusReason()).isEqualTo("payment refunded");
        assertThat(alreadyVoid.getStatus()).isEqualTo(TicketStatus.VOID);
        verify(ticketRepositoryPort, times(2)).save(any(Ticket.class));
        verify(outbox, times(2)).publish(any(), eq("ticket-voided"), eq("ticket-voided"), any(TicketVoidedEvent.class));
    }

    @Test
    void redeliveredRefundEventIsIdempotent() {
        UUID reservationId = UUID.randomUUID();
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of(ticket(TicketStatus.REFUNDED)));
        new RefundReservationApplicationService(ticketRepositoryPort, outbox).refundReservation(reservationId);
        verify(outbox, times(0)).publish(any(), any(), any(), any());
    }
}
