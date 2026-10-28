package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.InviteGuestsUseCase.Guest;
import com.techie.microservices.ticketing.catalog.application.port.InviteGuestsUseCase.InviteGuestsCommand;
import com.techie.microservices.ticketing.catalog.application.port.QrPayloadSignerPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidEventChangeException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeSoldOutException;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InviteGuestsApplicationServiceTest {

    @Mock private TicketTypeRepositoryPort types;
    @Mock private TicketRepositoryPort tickets;
    @Mock private EventRepositoryPort events;
    @Mock private QrPayloadSignerPort signer;
    @Mock private OutboxEventPublisherPort outbox;

    private InviteGuestsApplicationService service;
    private final UUID eventId = UUID.randomUUID();
    private final UUID typeId = UUID.randomUUID();
    private TicketType type;

    @BeforeEach
    void setUp() {
        service = new InviteGuestsApplicationService(types, tickets, events, signer, outbox);
        Instant now = Instant.now();
        type = TicketType.builder().ticketTypeId(typeId).eventId(eventId).quota(5).issuedCount(1).reservedCount(1)
                .validFrom(now).validUntil(now.plusSeconds(86400)).maxEntries(2).build();
    }

    private void happyStubs() {
        when(events.findByEventId(eventId)).thenReturn(Optional.of(Event.builder().eventId(eventId).status(EventStatus.DRAFT)
                .startsAt(Instant.now().plusSeconds(3600)).endsAt(Instant.now().plusSeconds(7200)).build()));
        when(types.findByTicketTypeIdForUpdate(typeId)).thenReturn(Optional.of(type));
    }

    private InviteGuestsCommand cmd(Guest... guests) {
        return new InviteGuestsCommand(eventId, typeId, List.of(guests), "org@x.com");
    }

    @Test
    void issuesAFreeSignedTicketPerGuestAgainstTheQuotaEvenForADraftEvent() {
        happyStubs();
        when(signer.sign(any())).thenReturn("qr");
        when(tickets.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));

        List<Ticket> issued = service.inviteGuests(cmd(new Guest("Ann", "Ann@X.com"), new Guest("Bo", "bo@x.com")));

        assertThat(issued).hasSize(2);
        assertThat(issued).allSatisfy(t -> {
            assertThat(t.getStatus()).isEqualTo(TicketStatus.ISSUED);
            assertThat(t.getSource()).isEqualTo("GUEST");
            assertThat(t.getPriceCents()).isZero();
            assertThat(t.getMaxEntries()).isEqualTo(2);
            assertThat(t.getQrPayload()).isEqualTo("qr");
        });
        assertThat(issued.get(0).getOwnerEmail()).isEqualTo("ann@x.com");
        assertThat(type.getIssuedCount()).isEqualTo(3);
        verify(outbox, times(2)).publish(any(), eq("ticket-issued"), eq("ticket-issued"), any());
    }

    @Test
    void allOrNothingWhenTheQuotaCannotCoverTheList() {
        happyStubs();
        type.setIssuedCount(4); // 1 free
        assertThatThrownBy(() -> service.inviteGuests(cmd(new Guest("A", "a@x.com"), new Guest("B", "b@x.com"))))
                .isInstanceOf(TicketTypeSoldOutException.class);
        verify(tickets, never()).save(any());
        verify(outbox, never()).publish(any(), any(), any(), any());
    }

    @Test
    void rejectsEmptyDuplicateAndMalformedGuestLists() {
        assertThatThrownBy(() -> service.inviteGuests(cmd())).isInstanceOf(InvalidEventChangeException.class);
        assertThatThrownBy(() -> service.inviteGuests(cmd(new Guest("A", "a@x.com"), new Guest("A2", "A@x.com")))).isInstanceOf(InvalidEventChangeException.class);
        assertThatThrownBy(() -> service.inviteGuests(cmd(new Guest("A", "nope")))).isInstanceOf(InvalidEventChangeException.class);
    }

    @Test
    void aTicketTypeOfAnotherEventLooksMissing() {
        when(events.findByEventId(eventId)).thenReturn(Optional.of(Event.builder().eventId(eventId).status(EventStatus.PUBLISHED)
                .endsAt(Instant.now().plusSeconds(7200)).build()));
        type.setEventId(UUID.randomUUID());
        when(types.findByTicketTypeIdForUpdate(typeId)).thenReturn(Optional.of(type));
        assertThatThrownBy(() -> service.inviteGuests(cmd(new Guest("A", "a@x.com")))).isInstanceOf(TicketTypeNotFoundException.class);
    }
}
