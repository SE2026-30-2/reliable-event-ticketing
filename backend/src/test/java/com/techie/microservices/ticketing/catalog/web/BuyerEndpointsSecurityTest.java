package com.techie.microservices.ticketing.catalog.web;

import com.techie.microservices.ticketing.catalog.application.port.GetTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListMyTicketsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListTicketsForEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ReservationResult;
import com.techie.microservices.ticketing.catalog.application.port.ResendTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.VoidTicketUseCase;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestCommand;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestUseCase;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import com.techie.microservices.ticketing.payment.web.PaymentController;
import com.techie.microservices.ticketing.shared.config.CorsConfig;
import com.techie.microservices.ticketing.shared.config.SecurityConfig;
import com.techie.microservices.ticketing.shared.web.error.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The real security filter chain over the real controllers (use cases mocked): proves who can call
 * what at the HTTP boundary - the part unit tests of the use cases cannot see. Identity must come
 * from the validated JWT, never from anything the client sends.
 */
@WebMvcTest(controllers = {TicketController.class, PaymentController.class})
@Import({SecurityConfig.class, CorsConfig.class, GlobalExceptionHandler.class,
        com.techie.microservices.ticketing.shared.web.ManagementAccess.class,
        com.techie.microservices.ticketing.shared.web.ratelimit.InMemoryRateLimiter.class})
class BuyerEndpointsSecurityTest {

    @Autowired MockMvc mvc;
    @MockBean ReserveTicketUseCase reserveTicketUseCase;
    @MockBean GetTicketUseCase getTicketUseCase;
    @MockBean ListTicketsForEventUseCase listTicketsForEventUseCase;
    @MockBean VoidTicketUseCase voidTicketUseCase;
    @MockBean ListMyTicketsUseCase listMyTicketsUseCase;
    @MockBean ResendTicketUseCase resendTicketUseCase;
    @MockBean com.techie.microservices.ticketing.catalog.application.port.TransferTicketUseCase transferTicketUseCase;
    @MockBean com.techie.microservices.ticketing.shared.application.port.EventAccessPort eventAccessPort;
    @MockBean CreatePaymentRequestUseCase createPaymentRequestUseCase;

    private final UUID ticketTypeId = UUID.randomUUID();
    private final UUID ticketId = UUID.randomUUID();
    private static final String RESERVE_BODY = "{\"quantity\":1,\"holderName\":\"A\",\"holderEmail\":\"a@example.com\"}";

    @Test
    void anonymousCallersCannotReservePayReadOrListTickets() throws Exception {
        mvc.perform(post("/api/ticket-types/{id}/reservations", ticketTypeId).contentType(MediaType.APPLICATION_JSON).content(RESERVE_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/payment/requests").contentType(MediaType.APPLICATION_JSON).content("{\"reservationId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/ticket/{id}", ticketId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/my/tickets")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ticket/{id}/resend", ticketId)).andExpect(status().isUnauthorized());
        verify(reserveTicketUseCase, never()).reserveTickets(any());
    }

    @Test
    void theTicketOwnerIsTheJwtSubjectNotAnythingInTheBody() throws Exception {
        when(reserveTicketUseCase.reserveTickets(any())).thenReturn(new ReservationResult(UUID.randomUUID(), List.of()));

        mvc.perform(post("/api/ticket-types/{id}/reservations", ticketTypeId)
                        .with(jwt().jwt(j -> j.subject("Buyer@Example.com")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":1,\"holderName\":\"A\",\"holderEmail\":\"a@example.com\",\"ownerEmail\":\"victim@example.com\"}"))
                .andExpect(status().isCreated());

        ArgumentCaptor<ReserveTicketCommand> captor = ArgumentCaptor.forClass(ReserveTicketCommand.class);
        verify(reserveTicketUseCase).reserveTickets(captor.capture());
        assertThat(captor.getValue().ownerEmail()).isEqualTo("buyer@example.com");
    }

    @Test
    void paymentIsAttributedToTheCallerSoOthersCannotPayForOrReadYourReservation() throws Exception {
        UUID reservationId = UUID.randomUUID();
        when(createPaymentRequestUseCase.createPaymentRequest(any())).thenReturn(PaymentRequest.builder()
                .paymentRequestId(UUID.randomUUID()).reservationId(reservationId).amountCents(1000)
                .status(PaymentStatus.COMPLETED).createdAt(Instant.now()).build());

        mvc.perform(post("/api/payment/requests").with(jwt().jwt(j -> j.subject("buyer@example.com")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reservationId\":\"" + reservationId + "\"}"))
                .andExpect(status().isCreated());

        ArgumentCaptor<CreatePaymentRequestCommand> captor = ArgumentCaptor.forClass(CreatePaymentRequestCommand.class);
        verify(createPaymentRequestUseCase).createPaymentRequest(captor.capture());
        assertThat(captor.getValue().requesterEmail()).isEqualTo("buyer@example.com");
    }

    @Test
    void someoneElsesTicketIsA404NotA403() throws Exception {
        when(getTicketUseCase.getTicketVisibleTo(eq(ticketId), eq("attacker@example.com"), eq(false)))
                .thenThrow(new TicketNotFoundException(ticketId));

        mvc.perform(get("/api/ticket/{id}", ticketId).with(jwt().jwt(j -> j.subject("attacker@example.com"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void anAdminIsRecognisedFromTheRolesClaimAuthority() throws Exception {
        when(getTicketUseCase.getTicketVisibleTo(eq(ticketId), eq("admin@example.com"), eq(true)))
                .thenReturn(Ticket.builder().ticketId(ticketId).status(TicketStatus.ISSUED).validFrom(Instant.now()).validUntil(Instant.now()).build());

        mvc.perform(get("/api/ticket/{id}", ticketId)
                        .with(jwt().jwt(j -> j.subject("admin@example.com")).authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ISSUED"));
    }

    @Test
    void myTicketsAreQueriedByTheCallerAndResendIsAccepted() throws Exception {
        when(listMyTicketsUseCase.listMyTickets(eq("buyer@example.com"), any())).thenReturn(new PageImpl<>(List.of()));

        mvc.perform(get("/api/my/tickets").with(jwt().jwt(j -> j.subject("Buyer@example.com")))).andExpect(status().isOk());
        mvc.perform(post("/api/ticket/{id}/resend", ticketId).with(jwt().jwt(j -> j.subject("buyer@example.com"))))
                .andExpect(status().isAccepted());

        verify(resendTicketUseCase).resendTicket(ticketId, "buyer@example.com", false);
    }

    @Test
    void aBuyerCannotUseAdminOnlyEndpoints() throws Exception {
        mvc.perform(get("/api/event/{id}/tickets", UUID.randomUUID()).with(jwt().jwt(j -> j.subject("buyer@example.com"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void transferRequiresLoginAndUsesTheJwtSubjectAsTheSender() throws Exception {
        String body = "{\"toEmail\":\"friend@example.com\",\"holderName\":\"F\"}";
        mvc.perform(post("/api/ticket/{id}/transfer", ticketId).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());

        Ticket created = Ticket.builder().ticketId(UUID.randomUUID()).ownerEmail("friend@example.com").build();
        when(transferTicketUseCase.transferTicket(any())).thenReturn(created);
        mvc.perform(post("/api/ticket/{id}/transfer", ticketId).contentType(MediaType.APPLICATION_JSON).content(body)
                        .with(jwt().jwt(j -> j.subject("Sender@Example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newTicketId").value(created.getTicketId().toString()))
                .andExpect(jsonPath("$.qrPayload").doesNotExist()); // the new QR is the recipient's, never echoed
        var captor = ArgumentCaptor.forClass(com.techie.microservices.ticketing.catalog.application.port.TransferTicketCommand.class);
        verify(transferTicketUseCase).transferTicket(captor.capture());
        assertThat(captor.getValue().requesterEmail()).isEqualTo("sender@example.com");
    }

    @Test
    void transferRejectsAnInvalidRecipientEmail() throws Exception {
        mvc.perform(post("/api/ticket/{id}/transfer", ticketId).contentType(MediaType.APPLICATION_JSON).content("{\"toEmail\":\"not-an-email\"}")
                        .with(jwt().jwt(j -> j.subject("sender@example.com"))))
                .andExpect(status().isBadRequest());
        verify(transferTicketUseCase, never()).transferTicket(any());
    }
}
