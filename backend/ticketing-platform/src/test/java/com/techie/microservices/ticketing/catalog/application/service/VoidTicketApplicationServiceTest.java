package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.VoidTicketCommand;
import com.techie.microservices.ticketing.catalog.domain.event.TicketVoidedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidTicketStatusTransitionException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VoidTicketApplicationServiceTest {

    @Mock
    private TicketRepositoryPort ticketRepositoryPort;
    @Mock
    private OutboxEventPublisherPort outboxEventPublisherPort;

    private VoidTicketApplicationService service;

    private final UUID ticketId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new VoidTicketApplicationService(ticketRepositoryPort, outboxEventPublisherPort);
    }

    private Ticket issuedTicket() {
        Instant now = Instant.now();
        return Ticket.builder()
                .id(1L)
                .ticketId(ticketId)
                .ticketTypeId(UUID.randomUUID())
                .eventId(UUID.randomUUID())
                .status(TicketStatus.ISSUED)
                .issuedAt(now)
                .validFrom(now)
                .validUntil(now.plusSeconds(3600))
                .qrPayload("signed-payload")
                .createdAt(now)
                .build();
    }

    @Test
    void transitionsIssuedTicketToVoidAndWritesOutboxEvent() {
        Ticket ticket = issuedTicket();
        when(ticketRepositoryPort.findByTicketId(ticketId)).thenReturn(Optional.of(ticket));
        when(ticketRepositoryPort.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));

        Ticket result = service.voidTicket(new VoidTicketCommand(ticketId, TicketStatus.VOID, "duplicate purchase"));

        assertThat(result.getStatus()).isEqualTo(TicketStatus.VOID);
        assertThat(result.getStatusReason()).isEqualTo("duplicate purchase");

        ArgumentCaptor<TicketVoidedEvent> captor = ArgumentCaptor.forClass(TicketVoidedEvent.class);
        verify(outboxEventPublisherPort).publish(eq(ticketId.toString()), eq("ticket-voided"), eq("ticket-voided"), captor.capture());
        assertThat(captor.getValue().status()).isEqualTo("VOID");
        assertThat(captor.getValue().reason()).isEqualTo("duplicate purchase");
        assertThat(captor.getValue().ticketId()).isEqualTo(ticketId);
    }

    @Test
    void rejectsVoidingATicketThatIsAlreadyVoidOrRefunded() {
        Ticket ticket = issuedTicket();
        ticket.setStatus(TicketStatus.REFUNDED);
        when(ticketRepositoryPort.findByTicketId(ticketId)).thenReturn(Optional.of(ticket));

        assertThatThrownBy(() -> service.voidTicket(new VoidTicketCommand(ticketId, TicketStatus.VOID, "retry")))
                .isInstanceOf(InvalidTicketStatusTransitionException.class);

        verifyNoInteractions(outboxEventPublisherPort);
    }

    @Test
    void rejectsVoidingATicketThatDoesNotExist() {
        when(ticketRepositoryPort.findByTicketId(ticketId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.voidTicket(new VoidTicketCommand(ticketId, TicketStatus.VOID, "x")))
                .isInstanceOf(TicketNotFoundException.class);
    }
}
