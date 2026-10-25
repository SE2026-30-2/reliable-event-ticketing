package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketQueryApplicationServiceTest {

    @Mock
    private TicketRepositoryPort ticketRepositoryPort;
    private TicketQueryApplicationService service;
    private final UUID ticketId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new TicketQueryApplicationService(ticketRepositoryPort);
    }

    private Ticket ticketOwnedBy(String owner) {
        return Ticket.builder().ticketId(ticketId).ownerEmail(owner).build();
    }

    @Test
    void theOwnerSeesTheirTicketRegardlessOfEmailCase() {
        when(ticketRepositoryPort.findByTicketId(ticketId)).thenReturn(Optional.of(ticketOwnedBy("buyer@example.com")));
        assertThat(service.getTicketVisibleTo(ticketId, "BUYER@Example.com", false).getTicketId()).isEqualTo(ticketId);
    }

    @Test
    void anotherBuyerGetsTheSameNotFoundAsForAMissingTicket() {
        when(ticketRepositoryPort.findByTicketId(ticketId)).thenReturn(Optional.of(ticketOwnedBy("buyer@example.com")));
        assertThatThrownBy(() -> service.getTicketVisibleTo(ticketId, "attacker@example.com", false))
                .isInstanceOf(TicketNotFoundException.class);
    }

    @Test
    void anAdminSeesAnyTicketIncludingLegacyAnonymousOnes() {
        when(ticketRepositoryPort.findByTicketId(ticketId)).thenReturn(Optional.of(ticketOwnedBy(null)));
        assertThat(service.getTicketVisibleTo(ticketId, "admin@example.com", true)).isNotNull();
    }

    @Test
    void aLegacyTicketWithNoOwnerIsInvisibleToEveryBuyer() {
        when(ticketRepositoryPort.findByTicketId(ticketId)).thenReturn(Optional.of(ticketOwnedBy(null)));
        assertThatThrownBy(() -> service.getTicketVisibleTo(ticketId, "buyer@example.com", false))
                .isInstanceOf(TicketNotFoundException.class);
    }

    @Test
    void myTicketsQueriesByTheNormalizedOwner() {
        var page = PageRequest.of(0, 20);
        when(ticketRepositoryPort.findByOwner("buyer@example.com", page)).thenReturn(new PageImpl<>(List.of(ticketOwnedBy("buyer@example.com"))));

        assertThat(service.listMyTickets("  Buyer@Example.com ", page).getContent()).hasSize(1);
        verify(ticketRepositoryPort).findByOwner("buyer@example.com", page);
    }
}
