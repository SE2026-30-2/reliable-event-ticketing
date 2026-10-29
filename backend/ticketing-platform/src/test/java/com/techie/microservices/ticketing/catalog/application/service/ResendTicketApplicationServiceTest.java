package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.GetTicketUseCase;
import com.techie.microservices.ticketing.catalog.domain.event.TicketResendRequestedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotResendableException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResendTicketApplicationServiceTest {

    @Mock
    private GetTicketUseCase getTicketUseCase;
    @Mock
    private OutboxEventPublisherPort outboxEventPublisherPort;
    private ResendTicketApplicationService service;
    private final UUID ticketId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ResendTicketApplicationService(getTicketUseCase, outboxEventPublisherPort);
    }

    private Ticket ticket(TicketStatus status) {
        return Ticket.builder().ticketId(ticketId).ticketTypeId(UUID.randomUUID()).eventId(UUID.randomUUID())
                .holderName("Holder").holderEmail("holder@example.com").qrPayload("kid.payload.sig")
                .status(status).validFrom(Instant.now()).validUntil(Instant.now().plusSeconds(3600)).issuedAt(Instant.now()).build();
    }

    @Test
    void anIssuedTicketIsRequeuedForEmailWithItsExactQrPayload() {
        when(getTicketUseCase.getTicketVisibleTo(ticketId, "buyer@example.com", false)).thenReturn(ticket(TicketStatus.ISSUED));

        service.resendTicket(ticketId, "buyer@example.com", false);

        ArgumentCaptor<TicketResendRequestedEvent> captor = ArgumentCaptor.forClass(TicketResendRequestedEvent.class);
        verify(outboxEventPublisherPort).publish(eq(ticketId.toString()), eq("ticket-resend-requested"), eq("ticket-resend-requested"), captor.capture());
        assertThat(captor.getValue().holderEmail()).isEqualTo("holder@example.com");
        assertThat(captor.getValue().qrPayload()).isEqualTo("kid.payload.sig");
    }

    @Test
    void aTicketThatIsNotIssuedCannotBeResent() {
        when(getTicketUseCase.getTicketVisibleTo(ticketId, "buyer@example.com", false)).thenReturn(ticket(TicketStatus.VOID));

        assertThatThrownBy(() -> service.resendTicket(ticketId, "buyer@example.com", false))
                .isInstanceOf(TicketNotResendableException.class);
        verify(outboxEventPublisherPort, never()).publish(any(), any(), any(), any());
    }

    @Test
    void someoneElsesTicketIsNeverResent() {
        when(getTicketUseCase.getTicketVisibleTo(ticketId, "attacker@example.com", false)).thenThrow(new TicketNotFoundException(ticketId));

        assertThatThrownBy(() -> service.resendTicket(ticketId, "attacker@example.com", false))
                .isInstanceOf(TicketNotFoundException.class);
        verify(outboxEventPublisherPort, never()).publish(any(), any(), any(), any());
    }
}
