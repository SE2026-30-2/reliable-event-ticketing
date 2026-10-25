package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.ReservationResult;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.WaitlistRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.event.WaitlistOfferedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeSoldOutException;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistEntry;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
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
class WaitlistPromotionServiceTest {

    @Mock private WaitlistRepositoryPort waitlist;
    @Mock private TicketRepositoryPort tickets;
    @Mock private TicketTypeRepositoryPort types;
    @Mock private EventRepositoryPort events;
    @Mock private ReserveTicketUseCase reserve;
    @Mock private OutboxEventPublisherPort outbox;

    private WaitlistPromotionService service() {
        return new WaitlistPromotionService(waitlist, tickets, types, events, reserve, outbox);
    }

    private final UUID typeId = UUID.randomUUID();
    private final UUID eventId = UUID.randomUUID();

    private WaitlistEntry entry(WaitlistStatus status) {
        return WaitlistEntry.builder().entryId(UUID.randomUUID()).ticketTypeId(typeId).ownerEmail("b@x.com").holderName("B")
                .holderEmail("b@x.com").quantity(2).status(status).build();
    }

    @Test
    void promotingReservesAsTheWaitlistMarksTheEntryOfferedAndEmailsTheLink() {
        WaitlistEntry e = entry(WaitlistStatus.WAITING);
        UUID reservationId = UUID.randomUUID();
        Instant expires = Instant.now().plusSeconds(600);
        when(waitlist.findByEntryIdForUpdateSkipLocked(e.getEntryId())).thenReturn(Optional.of(e));
        when(reserve.reserveTickets(any(ReserveTicketCommand.class))).thenReturn(new ReservationResult(reservationId,
                List.of(Ticket.builder().reservationExpiresAt(expires).build(), Ticket.builder().reservationExpiresAt(expires).build())));
        when(types.findByTicketTypeId(typeId)).thenReturn(Optional.of(TicketType.builder().ticketTypeId(typeId).eventId(eventId).build()));
        when(events.findByEventId(eventId)).thenReturn(Optional.of(Event.builder().eventId(eventId).name("Big Gig").build()));

        assertThat(service().promote(e.getEntryId())).isTrue();

        ArgumentCaptor<ReserveTicketCommand> cmd = ArgumentCaptor.forClass(ReserveTicketCommand.class);
        verify(reserve).reserveTickets(cmd.capture());
        assertThat(cmd.getValue().fromWaitlist()).isTrue(); // entitled to the quota the waitlist is guarding
        assertThat(cmd.getValue().ownerEmail()).isEqualTo("b@x.com");
        assertThat(e.getStatus()).isEqualTo(WaitlistStatus.OFFERED);
        assertThat(e.getReservationId()).isEqualTo(reservationId);
        ArgumentCaptor<WaitlistOfferedEvent> ev = ArgumentCaptor.forClass(WaitlistOfferedEvent.class);
        verify(outbox).publish(any(), eq("waitlist-offered"), eq("waitlist-offered"), ev.capture());
        assertThat(ev.getValue().eventName()).isEqualTo("Big Gig");
        assertThat(ev.getValue().ticketCount()).isEqualTo(2);
    }

    @Test
    void anEntryThatIsNoLongerWaitingOrIsLockedElsewhereIsSkipped() {
        UUID id = UUID.randomUUID();
        when(waitlist.findByEntryIdForUpdateSkipLocked(id)).thenReturn(Optional.empty());
        assertThat(service().promote(id)).isFalse();
        WaitlistEntry done = entry(WaitlistStatus.CANCELLED);
        when(waitlist.findByEntryIdForUpdateSkipLocked(done.getEntryId())).thenReturn(Optional.of(done));
        assertThat(service().promote(done.getEntryId())).isFalse();
        verify(reserve, never()).reserveTickets(any());
    }

    @Test
    void noRoomPropagatesSoTheTransactionRollsBackAndTheEntryKeepsItsPlace() {
        WaitlistEntry e = entry(WaitlistStatus.WAITING);
        when(waitlist.findByEntryIdForUpdateSkipLocked(e.getEntryId())).thenReturn(Optional.of(e));
        when(reserve.reserveTickets(any())).thenThrow(new TicketTypeSoldOutException(typeId, 2, 1));
        assertThatThrownBy(() -> service().promote(e.getEntryId())).isInstanceOf(TicketTypeSoldOutException.class);
        verify(waitlist, never()).save(any());
        verify(outbox, never()).publish(any(), any(), any(), any());
    }

    @Test
    void settleMarksPaidOffersConvertedAndLapsedOnesExpired() {
        WaitlistEntry paid = entry(WaitlistStatus.OFFERED);
        paid.setReservationId(UUID.randomUUID());
        WaitlistEntry lapsed = entry(WaitlistStatus.OFFERED);
        lapsed.setReservationId(UUID.randomUUID());
        WaitlistEntry open = entry(WaitlistStatus.OFFERED);
        open.setReservationId(UUID.randomUUID());
        when(waitlist.findByStatus(WaitlistStatus.OFFERED)).thenReturn(List.of(paid, lapsed, open));
        when(tickets.findByReservationId(paid.getReservationId())).thenReturn(List.of(Ticket.builder().status(TicketStatus.ISSUED).build()));
        when(tickets.findByReservationId(lapsed.getReservationId())).thenReturn(List.of(Ticket.builder().status(TicketStatus.CANCELLED).build()));
        when(tickets.findByReservationId(open.getReservationId())).thenReturn(List.of(Ticket.builder().status(TicketStatus.RESERVED).build()));

        assertThat(service().settleOffers()).isEqualTo(2);

        assertThat(paid.getStatus()).isEqualTo(WaitlistStatus.CONVERTED);
        assertThat(lapsed.getStatus()).isEqualTo(WaitlistStatus.EXPIRED);
        assertThat(open.getStatus()).isEqualTo(WaitlistStatus.OFFERED); // still being paid
    }

    @Test
    void giveUpOnlyTouchesEntriesStillWaiting() {
        WaitlistEntry e = entry(WaitlistStatus.WAITING);
        when(waitlist.findByEntryId(e.getEntryId())).thenReturn(Optional.of(e));
        service().giveUp(e.getEntryId(), "event closed");
        assertThat(e.getStatus()).isEqualTo(WaitlistStatus.EXPIRED);
        assertThat(e.getFailureReason()).isEqualTo("event closed");
    }
}
