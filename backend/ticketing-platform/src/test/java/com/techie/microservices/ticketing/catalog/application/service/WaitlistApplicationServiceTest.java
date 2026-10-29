package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.CancelReservationCommand;
import com.techie.microservices.ticketing.catalog.application.port.CancelReservationUseCase;
import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.WaitlistRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.WaitlistUseCase.JoinWaitlistCommand;
import com.techie.microservices.ticketing.catalog.domain.exception.WaitlistEntryNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.WaitlistException;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistEntry;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
        when(waitlist.countActiveByOwner("buyer@x.com")).thenReturn(5L);
        assertThatThrownBy(() -> service.join(join(1))).isInstanceOf(WaitlistException.class).hasMessageContaining("at most");
    }

    @Test
    void leavingAWaitingEntryJustCancelsIt() {
        UUID id = UUID.randomUUID();
        WaitlistEntry e = WaitlistEntry.builder().entryId(id).ownerEmail("buyer@x.com").status(WaitlistStatus.WAITING).build();
        when(waitlist.findByEntryId(id)).thenReturn(Optional.of(e));
        when(waitlist.save(any(WaitlistEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        assertThat(service.leave(id, "BUYER@x.com").getStatus()).isEqualTo(WaitlistStatus.CANCELLED);
        verify(cancelReservation, never()).cancelReservation(any());
    }

    @Test
    void decliningAnOfferReleasesItsHeldTickets() {
        UUID id = UUID.randomUUID();
        UUID reservationId = UUID.randomUUID();
        WaitlistEntry e = WaitlistEntry.builder().entryId(id).ownerEmail("buyer@x.com").status(WaitlistStatus.OFFERED).reservationId(reservationId).build();
        when(waitlist.findByEntryId(id)).thenReturn(Optional.of(e));
        when(waitlist.save(any(WaitlistEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        service.leave(id, "buyer@x.com");
        verify(cancelReservation).cancelReservation(new CancelReservationCommand(reservationId, "waitlist offer declined"));
    }

    @Test
    void someoneElsesEntryLooksMissingAndFinishedEntriesCannotBeLeft() {
        UUID id = UUID.randomUUID();
        when(waitlist.findByEntryId(id)).thenReturn(Optional.of(WaitlistEntry.builder().entryId(id).ownerEmail("other@x.com").status(WaitlistStatus.WAITING).build()));
        assertThatThrownBy(() -> service.leave(id, "buyer@x.com")).isInstanceOf(WaitlistEntryNotFoundException.class);

        UUID done = UUID.randomUUID();
        when(waitlist.findByEntryId(done)).thenReturn(Optional.of(WaitlistEntry.builder().entryId(done).ownerEmail("buyer@x.com").status(WaitlistStatus.CONVERTED).build()));
        assertThatThrownBy(() -> service.leave(done, "buyer@x.com")).isInstanceOf(WaitlistException.class);
    }
}
