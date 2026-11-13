package com.ticketing.catalog.application.service;

import com.ticketing.catalog.application.port.CancelReservationCommand;
import com.ticketing.catalog.application.port.CancelReservationUseCase;
import com.ticketing.catalog.application.port.EventRepositoryPort;
import com.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.ticketing.catalog.application.port.WaitlistRepositoryPort;
import com.ticketing.catalog.application.port.WaitlistUseCase.JoinWaitlistCommand;
import com.ticketing.catalog.domain.exception.WaitlistEntryNotFoundException;
import com.ticketing.catalog.domain.exception.WaitlistException;
import com.ticketing.catalog.domain.model.Event;
import com.ticketing.catalog.domain.model.EventStatus;
import com.ticketing.catalog.domain.model.TicketType;
import com.ticketing.catalog.domain.model.WaitlistEntry;
import com.ticketing.catalog.domain.model.WaitlistStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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
class WaitlistApplicationServiceTest {

    @Mock private WaitlistRepositoryPort waitlist;
    @Mock private TicketTypeRepositoryPort types;
    @Mock private EventRepositoryPort events;
    @Mock private CancelReservationUseCase cancelReservation;

    private WaitlistApplicationService service;
    private final UUID eventId = UUID.randomUUID();
    private final UUID typeId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new WaitlistApplicationService(waitlist, types, events, cancelReservation);
        ReflectionTestUtils.setField(service, "maxActivePerAccount", 5);
    }

    private void soldOutType(int quota, int issued, int reserved) {
        when(types.findByTicketTypeIdForUpdate(typeId)).thenReturn(Optional.of(TicketType.builder().ticketTypeId(typeId).eventId(eventId)
                .quota(quota).issuedCount(issued).reservedCount(reserved).bundleSize(1).build()));
        when(events.findByEventId(eventId)).thenReturn(Optional.of(Event.builder().eventId(eventId).status(EventStatus.PUBLISHED)
                .startsAt(Instant.now().plusSeconds(3600)).endsAt(Instant.now().plusSeconds(7200)).build()));
    }

    private JoinWaitlistCommand join(int qty) {
        return new JoinWaitlistCommand("Buyer@X.com", typeId, qty, "B", "Buyer@X.com");
    }

    @Test
    void joinsAWaitingListOnlyWhenTheRequestedQuantityIsNotAvailable() {
        soldOutType(10, 9, 1);
        when(waitlist.sumWaitingQuantity(typeId)).thenReturn(0L);
        when(waitlist.findActive(typeId, "buyer@x.com")).thenReturn(Optional.empty());
        when(waitlist.save(any(WaitlistEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        WaitlistEntry entry = service.join(join(2));

        assertThat(entry.getStatus()).isEqualTo(WaitlistStatus.WAITING);
        assertThat(entry.getOwnerEmail()).isEqualTo("buyer@x.com");
        assertThat(entry.getQuantity()).isEqualTo(2);
    }

    @Test
    void refusesWhenTicketsAreAvailableRightNow() {
        soldOutType(10, 5, 0);
        when(waitlist.sumWaitingQuantity(typeId)).thenReturn(0L);
        assertThatThrownBy(() -> service.join(join(2))).isInstanceOf(WaitlistException.class).hasMessageContaining("available");
        verify(waitlist, never()).save(any());
    }

    @Test
    void quotaAlreadySpokenForByPeopleAheadDoesNotCountAsAvailable() {
        soldOutType(10, 6, 0); // 4 free but 4 units are already waiting for them
        when(waitlist.sumWaitingQuantity(typeId)).thenReturn(4L);
        when(waitlist.findActive(typeId, "buyer@x.com")).thenReturn(Optional.empty());
        when(waitlist.save(any(WaitlistEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        assertThat(service.join(join(1)).getStatus()).isEqualTo(WaitlistStatus.WAITING);
    }

    @Test
    void oneLivePlaceInLinePerTicketTypeAndACapPerAccount() {
        soldOutType(10, 10, 0);
        when(waitlist.sumWaitingQuantity(typeId)).thenReturn(0L);
        when(waitlist.findActive(typeId, "buyer@x.com")).thenReturn(Optional.of(WaitlistEntry.builder().build()));
        assertThatThrownBy(() -> service.join(join(1))).isInstanceOf(WaitlistException.class).hasMessageContaining("already");

        when(waitlist.findActive(typeId, "buyer@x.com")).thenReturn(Optional.empty());
        when(waitlist.countActiveOrUndoableByOwner(eq("buyer@x.com"), any())).thenReturn(5L);
        assertThatThrownBy(() -> service.join(join(1))).isInstanceOf(WaitlistException.class).hasMessageContaining("at most");
    }

    @Test
    void cannotRejoinWhileThePreviousEntryCanStillBeUndone() {
        soldOutType(10, 10, 0);
        when(waitlist.sumWaitingQuantity(typeId)).thenReturn(0L);
        when(waitlist.findActive(typeId, "buyer@x.com")).thenReturn(Optional.empty());
        when(waitlist.findUndoableByTicketTypeAndOwner(eq(typeId), eq("buyer@x.com"), any()))
                .thenReturn(Optional.of(WaitlistEntry.builder().status(WaitlistStatus.CANCELLED).build()));

        assertThatThrownBy(() -> service.join(join(1)))
                .isInstanceOf(WaitlistException.class).hasMessageContaining("undo");
        verify(waitlist, never()).save(any());
    }

    @Test
    void leavingAWaitingEntryJustCancelsIt() {
        UUID id = UUID.randomUUID();
        WaitlistEntry e = WaitlistEntry.builder().entryId(id).ownerEmail("buyer@x.com").status(WaitlistStatus.WAITING).build();
        when(waitlist.findByEntryIdForUpdate(id)).thenReturn(Optional.of(e));
        when(waitlist.save(any(WaitlistEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        assertThat(service.leave(id, "BUYER@x.com").getStatus()).isEqualTo(WaitlistStatus.CANCELLED);
        assertThat(e.getCancelledAt()).isNotNull();
        verify(cancelReservation, never()).cancelReservation(any());
    }

    @Test
    void undoLeaveRestoresWaitingAndPreservesOriginalQueuePositionBeforeThirtySeconds() {
        Instant now = Instant.parse("2026-11-10T10:00:30Z");
        Instant createdAt = now.minusSeconds(300);
        UUID id = UUID.randomUUID();
        WaitlistEntry entry = WaitlistEntry.builder().entryId(id).ownerEmail("buyer@x.com")
                .status(WaitlistStatus.CANCELLED).createdAt(createdAt).cancelledAt(now.minusMillis(29_999)).build();
        org.springframework.test.util.ReflectionTestUtils.setField(service, "clock", Clock.fixed(now, ZoneOffset.UTC));
        when(waitlist.findByEntryIdForUpdate(id)).thenReturn(Optional.of(entry));
        when(waitlist.save(any(WaitlistEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        WaitlistEntry restored = service.undoLeave(id, "BUYER@x.com");

        assertThat(restored.getStatus()).isEqualTo(WaitlistStatus.WAITING);
        assertThat(restored.getCancelledAt()).isNull();
        assertThat(restored.getCreatedAt()).isEqualTo(createdAt);
        verify(waitlist).findByEntryIdForUpdate(id);
        verify(waitlist).save(entry);
        verify(cancelReservation, never()).cancelReservation(any());
    }

    @Test
    void undoLeaveRejectsAtTheThirtySecondBoundary() {
        Instant cancelledAt = Instant.parse("2026-11-10T10:00:00Z");
        Instant deadline = cancelledAt.plusSeconds(30);
        UUID id = UUID.randomUUID();
        WaitlistEntry entry = WaitlistEntry.builder().entryId(id).ownerEmail("buyer@x.com")
                .status(WaitlistStatus.CANCELLED).cancelledAt(cancelledAt).build();
        org.springframework.test.util.ReflectionTestUtils.setField(service, "clock", Clock.fixed(deadline, ZoneOffset.UTC));
        when(waitlist.findByEntryIdForUpdate(id)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> service.undoLeave(id, "buyer@x.com"))
                .isInstanceOf(WaitlistException.class).hasMessageContaining("expired");

        verify(waitlist, never()).save(any());
    }

    @Test
    void undoLeaveHidesForeignEntriesAndRejectsEntriesThatAreNotUndoable() {
        UUID foreignId = UUID.randomUUID();
        when(waitlist.findByEntryIdForUpdate(foreignId)).thenReturn(Optional.of(WaitlistEntry.builder()
                .entryId(foreignId).ownerEmail("other@x.com").status(WaitlistStatus.CANCELLED).build()));
        assertThatThrownBy(() -> service.undoLeave(foreignId, "buyer@x.com"))
                .isInstanceOf(WaitlistEntryNotFoundException.class);

        UUID offeredId = UUID.randomUUID();
        when(waitlist.findByEntryIdForUpdate(offeredId)).thenReturn(Optional.of(WaitlistEntry.builder()
                .entryId(offeredId).ownerEmail("buyer@x.com").status(WaitlistStatus.OFFERED).build()));
        assertThatThrownBy(() -> service.undoLeave(offeredId, "buyer@x.com"))
                .isInstanceOf(WaitlistException.class);

        verify(waitlist, never()).save(any());
    }

    @Test
    void decliningAnOfferReleasesItsHeldTickets() {
        UUID id = UUID.randomUUID();
        UUID reservationId = UUID.randomUUID();
        WaitlistEntry e = WaitlistEntry.builder().entryId(id).ownerEmail("buyer@x.com").status(WaitlistStatus.OFFERED).reservationId(reservationId).build();
        when(waitlist.findByEntryIdForUpdate(id)).thenReturn(Optional.of(e));
        when(waitlist.save(any(WaitlistEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        service.leave(id, "buyer@x.com");
        verify(cancelReservation).cancelReservation(new CancelReservationCommand(reservationId, "waitlist offer declined"));
    }

    @Test
    void someoneElsesEntryLooksMissingAndFinishedEntriesCannotBeLeft() {
        UUID id = UUID.randomUUID();
        when(waitlist.findByEntryIdForUpdate(id)).thenReturn(Optional.of(WaitlistEntry.builder().entryId(id).ownerEmail("other@x.com").status(WaitlistStatus.WAITING).build()));
        assertThatThrownBy(() -> service.leave(id, "buyer@x.com")).isInstanceOf(WaitlistEntryNotFoundException.class);

        UUID done = UUID.randomUUID();
        when(waitlist.findByEntryIdForUpdate(done)).thenReturn(Optional.of(WaitlistEntry.builder().entryId(done).ownerEmail("buyer@x.com").status(WaitlistStatus.CONVERTED).build()));
        assertThatThrownBy(() -> service.leave(done, "buyer@x.com")).isInstanceOf(WaitlistException.class);
    }
}
