package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.QrPayloadSignerPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TransferTicketCommand;
import com.techie.microservices.ticketing.catalog.domain.event.TicketIssuedEvent;
import com.techie.microservices.ticketing.catalog.domain.event.TicketVoidedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotTransferableException;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketQrClaims;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import com.techie.microservices.ticketing.shared.application.port.TicketUsagePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransferTicketApplicationServiceTest {

    @Mock private TicketRepositoryPort tickets;
    @Mock private EventRepositoryPort events;
    @Mock private QrPayloadSignerPort signer;
    @Mock private OutboxEventPublisherPort outbox;
    @Mock private TicketUsagePort usage;

    private TransferTicketApplicationService service;
    private Ticket ticket;
    private final UUID eventId = UUID.randomUUID();
    private final UUID reservationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new TransferTicketApplicationService(tickets, events, signer, outbox, usage);
        ReflectionTestUtils.setField(service, "maxTransfers", 2);
        ReflectionTestUtils.setField(service, "cutoffMinutes", 60L);
        Instant now = Instant.now();
        ticket = Ticket.builder().ticketId(UUID.randomUUID()).ticketTypeId(UUID.randomUUID()).eventId(eventId)
                .ownerEmail("alice@x.com").holderName("Alice").holderEmail("alice@x.com").status(TicketStatus.ISSUED)
                .reservationId(reservationId).validFrom(now.minusSeconds(60)).validUntil(now.plusSeconds(86400))
                .qrPayload("old-qr").maxEntries(3).build();
        lenient(ticket);
    }

    private void lenient(Ticket t) {
        org.mockito.Mockito.lenient().when(tickets.findByTicketIdForUpdate(t.getTicketId())).thenReturn(Optional.of(t));
        org.mockito.Mockito.lenient().when(events.findByEventId(eventId)).thenReturn(Optional.of(Event.builder().eventId(eventId)
                .status(EventStatus.PUBLISHED).startsAt(Instant.now().plusSeconds(86400)).endsAt(Instant.now().plusSeconds(90000)).build()));
        org.mockito.Mockito.lenient().when(tickets.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
        org.mockito.Mockito.lenient().when(usage.voidIfUnused(any(), any())).thenReturn(true);
        org.mockito.Mockito.lenient().when(signer.sign(any(TicketQrClaims.class))).thenReturn("new-qr");
    }

    private TransferTicketCommand cmd(String requester, String to) {
        return new TransferTicketCommand(ticket.getTicketId(), requester, to, "Bob");
    }

    @Test
    void voidsTheOldTicketIssuesANewOneWithANewQrAndKeepsTheReservationAndEntryLimit() {
        Ticket created = service.transferTicket(cmd("ALICE@x.com", " Bob@X.com "));

        assertThat(ticket.getStatus()).isEqualTo(TicketStatus.TRANSFERRED);
        assertThat(created.getTicketId()).isNotEqualTo(ticket.getTicketId());
        assertThat(created.getStatus()).isEqualTo(TicketStatus.ISSUED);
        assertThat(created.getOwnerEmail()).isEqualTo("bob@x.com");
        assertThat(created.getQrPayload()).isEqualTo("new-qr");
        assertThat(created.getReservationId()).isEqualTo(reservationId); // a later refund still finds the live ticket
        assertThat(created.getMaxEntries()).isEqualTo(3);
        assertThat(created.getTransferCount()).isEqualTo(1);
        assertThat(created.getTransferredFrom()).isEqualTo(ticket.getTicketId());

        ArgumentCaptor<TicketQrClaims> claims = ArgumentCaptor.forClass(TicketQrClaims.class);
        verify(signer).sign(claims.capture());
        assertThat(claims.getValue().ticketId()).isEqualTo(created.getTicketId()); // signed for the NEW id
        assertThat(claims.getValue().maxEntries()).isEqualTo(3);
        verify(usage).voidIfUnused(eq(ticket.getTicketId()), any());
        verify(outbox).publish(any(), eq("ticket-voided"), eq("ticket-voided"), any(TicketVoidedEvent.class));
        verify(outbox).publish(any(), eq("ticket-issued"), eq("ticket-issued"), any(TicketIssuedEvent.class));
    }

    @Test
    void someoneElsesTicketLooksMissing() {
        assertThatThrownBy(() -> service.transferTicket(cmd("mallory@x.com", "bob@x.com"))).isInstanceOf(TicketNotFoundException.class);
        verify(usage, never()).voidIfUnused(any(), any());
    }

    @Test
    void onlyIssuedTicketsAndNotToYourselfAndNotBeyondTheLimit() {
        ticket.setStatus(TicketStatus.VOID);
        assertThatThrownBy(() -> service.transferTicket(cmd("alice@x.com", "bob@x.com"))).isInstanceOf(TicketNotTransferableException.class);
        ticket.setStatus(TicketStatus.ISSUED);
        assertThatThrownBy(() -> service.transferTicket(cmd("alice@x.com", "Alice@X.com"))).isInstanceOf(TicketNotTransferableException.class);
        ticket.setTransferCount(2);
        assertThatThrownBy(() -> service.transferTicket(cmd("alice@x.com", "bob@x.com"))).isInstanceOf(TicketNotTransferableException.class)
                .hasMessageContaining("maximum");
        verify(outbox, never()).publish(any(), any(), any(), any());
    }

    @Test
    void closedShortlyBeforeTheEventStarts() {
        when(events.findByEventId(eventId)).thenReturn(Optional.of(Event.builder().eventId(eventId)
                .startsAt(Instant.now().plusSeconds(600)).endsAt(Instant.now().plusSeconds(7200)).build()));
        assertThatThrownBy(() -> service.transferTicket(cmd("alice@x.com", "bob@x.com")))
                .isInstanceOf(TicketNotTransferableException.class).hasMessageContaining("closed");
    }

    @Test
    void refusedWhenTheTicketWasAlreadyScannedIn() {
        when(usage.voidIfUnused(any(), any())).thenReturn(false);
        assertThatThrownBy(() -> service.transferTicket(cmd("alice@x.com", "bob@x.com")))
                .isInstanceOf(TicketNotTransferableException.class).hasMessageContaining("already been used");
        assertThat(ticket.getStatus()).isEqualTo(TicketStatus.ISSUED);
        verify(outbox, never()).publish(any(), any(), any(), any());
    }

    @Test
    void canBeDisabled() {
        ReflectionTestUtils.setField(service, "maxTransfers", 0);
        assertThatThrownBy(() -> service.transferTicket(cmd("alice@x.com", "bob@x.com"))).isInstanceOf(TicketNotTransferableException.class);
    }
}
