package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.ReservationPayment;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotPayableException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GetReservationPaymentApplicationServiceTest {

    @Mock
    private TicketRepositoryPort ticketRepositoryPort;
    @Mock
    private TicketTypeRepositoryPort ticketTypeRepositoryPort;

    private GetReservationPaymentApplicationService service;
    private final UUID reservationId = UUID.randomUUID();
    private final UUID ticketTypeId = UUID.randomUUID();
    private static final String OWNER = "buyer@example.com";

    @BeforeEach
    void setUp() {
        service = new GetReservationPaymentApplicationService(ticketRepositoryPort);
    }

    private Ticket ticket(TicketStatus status, Instant expiresAt) {
        return Ticket.builder().ticketId(UUID.randomUUID()).ticketTypeId(ticketTypeId).ownerEmail("Buyer@Example.com").status(status)
                .reservationId(reservationId).reservationExpiresAt(expiresAt).priceCents(25_000).build();
    }

    @Test
    void amountIsTheSumOfWhatEachReservedTicketWasSoldFor() {
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of(
                ticket(TicketStatus.RESERVED, Instant.now().plusSeconds(300)),
                ticket(TicketStatus.RESERVED, Instant.now().plusSeconds(300))));

        ReservationPayment payment = service.getPayableReservation(reservationId, OWNER);

        assertThat(payment.amountCents()).isEqualTo(50_000);
        assertThat(payment.ticketCount()).isEqualTo(2);
    }

    @Test
    void unknownReservationIsNotFound() {
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of());
        assertThatThrownBy(() -> service.getPayableReservation(reservationId, OWNER)).isInstanceOf(ReservationNotFoundException.class);
    }

    @Test
    void anAlreadyResolvedReservationCannotBePaidAgain() {
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of(ticket(TicketStatus.ISSUED, null)));
        assertThatThrownBy(() -> service.getPayableReservation(reservationId, OWNER))
                .isInstanceOf(ReservationNotPayableException.class).hasMessageContaining("ISSUED");
    }

    @Test
    void anExpiredButNotYetSweptReservationCannotBePaid() {
        when(ticketRepositoryPort.findByReservationId(reservationId))
                .thenReturn(List.of(ticket(TicketStatus.RESERVED, Instant.now().minusSeconds(5))));
        assertThatThrownBy(() -> service.getPayableReservation(reservationId, OWNER))
                .isInstanceOf(ReservationNotPayableException.class).hasMessageContaining("expired");
    }

    @Test
    void aReservationBelongingToSomeoneElseLooksExactlyLikeAMissingOne() {
        when(ticketRepositoryPort.findByReservationId(reservationId))
                .thenReturn(List.of(ticket(TicketStatus.RESERVED, Instant.now().plusSeconds(300))));

        assertThatThrownBy(() -> service.getPayableReservation(reservationId, "attacker@example.com"))
                .isInstanceOf(ReservationNotFoundException.class);
        assertThatThrownBy(() -> service.assertReservationOwnedBy(reservationId, "attacker@example.com"))
                .isInstanceOf(ReservationNotFoundException.class);
    }

    @Test
    void aLegacyReservationWithNoOwnerBelongsToNobody() {
        Ticket legacy = Ticket.builder().ticketId(UUID.randomUUID()).ticketTypeId(ticketTypeId)
                .status(TicketStatus.RESERVED).reservationId(reservationId).build();
        when(ticketRepositoryPort.findByReservationId(reservationId)).thenReturn(List.of(legacy));

        assertThatThrownBy(() -> service.assertReservationOwnedBy(reservationId, OWNER))
                .isInstanceOf(ReservationNotFoundException.class);
    }
}
