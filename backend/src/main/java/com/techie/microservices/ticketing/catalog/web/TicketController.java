package com.techie.microservices.ticketing.catalog.web;

import com.techie.microservices.ticketing.catalog.application.port.GetTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListMyTicketsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListTicketsForEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ResendTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TransferTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.TransferTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.VoidTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.VoidTicketUseCase;
import com.techie.microservices.ticketing.catalog.web.dto.ReservationResponse;
import com.techie.microservices.ticketing.catalog.web.dto.ReserveTicketRequest;
import com.techie.microservices.ticketing.catalog.web.dto.TicketResponse;
import com.techie.microservices.ticketing.catalog.web.dto.TransferTicketRequest;
import com.techie.microservices.ticketing.catalog.web.dto.TransferTicketResponse;
import com.techie.microservices.ticketing.catalog.web.dto.VoidTicketRequest;
import com.techie.microservices.ticketing.shared.web.AuthenticatedUser;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TicketController {

    private final ReserveTicketUseCase reserveTicketUseCase;
    private final GetTicketUseCase getTicketUseCase;
    private final ListTicketsForEventUseCase listTicketsForEventUseCase;
    private final VoidTicketUseCase voidTicketUseCase;
    private final ListMyTicketsUseCase listMyTicketsUseCase;
    private final ResendTicketUseCase resendTicketUseCase;
    private final ManagementAccess access;
    private final TransferTicketUseCase transferTicketUseCase;

    /** Off for local demos (no SMTP to verify with); on by default so a real deployment cannot be farmed with throwaway emails. */
    @Value("${ticketing.require-verified-email:true}")
    private boolean requireVerifiedEmail;

    /** Requires a logged-in buyer (any user-service account) - the tickets are owned by the JWT
     * subject, never by anything in the body. Holds quota pending payment; the caller takes the
     * returned reservationId to POST /api/payment/requests next. Tickets become ISSUED (QR signed)
     * only once that payment succeeds, via the payment-completed Kafka listener, not this call. */
    @PostMapping("/api/ticket-types/{ticketTypeId}/reservations")
    public ResponseEntity<ReservationResponse> reserveTickets(@PathVariable UUID ticketTypeId,
                                                               @Valid @RequestBody ReserveTicketRequest request,
                                                               @AuthenticationPrincipal Jwt jwt) {
        AuthenticatedUser.requireVerifiedEmail(jwt, requireVerifiedEmail);
        var result = reserveTicketUseCase.reserveTickets(new ReserveTicketCommand(
                AuthenticatedUser.email(jwt), ticketTypeId, request.quantity(), request.holderName(), request.holderEmail(), request.couponCode()));
        return ResponseEntity.status(HttpStatus.CREATED).body(ReservationResponse.from(result));
    }

    /** Owner or ADMIN only; anyone else gets the same 404 as for a ticket that does not exist. */
    @GetMapping("/api/ticket/{ticketId}")
    public TicketResponse getTicket(@PathVariable UUID ticketId, @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        return TicketResponse.from(getTicketUseCase.getTicketVisibleTo(
                ticketId, AuthenticatedUser.email(jwt), AuthenticatedUser.isAdmin(authentication)));
    }

    /** The caller's own tickets, newest first (the sort is fixed server-side). */
    @GetMapping("/api/my/tickets")
    public Page<TicketResponse> myTickets(@AuthenticationPrincipal Jwt jwt,
                                          @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return listMyTicketsUseCase.listMyTickets(AuthenticatedUser.email(jwt), pageable).map(TicketResponse::from);
    }

    /** Re-emails an ISSUED ticket (with its QR) to the holder - for a lost or never-received email. */
    @PostMapping("/api/ticket/{ticketId}/resend")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void resendTicket(@PathVariable UUID ticketId, @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        resendTicketUseCase.resendTicket(ticketId, AuthenticatedUser.email(jwt), AuthenticatedUser.isAdmin(authentication));
    }

    /** Owner only. The recipient gets a new ticket (new QR, emailed to them); this one stops working. */
    @PostMapping("/api/ticket/{ticketId}/transfer")
    public TransferTicketResponse transferTicket(@PathVariable UUID ticketId, @Valid @RequestBody TransferTicketRequest request,
                                                 @AuthenticationPrincipal Jwt jwt) {
        var created = transferTicketUseCase.transferTicket(new TransferTicketCommand(
                ticketId, AuthenticatedUser.email(jwt), request.toEmail(), request.holderName()));
        return new TransferTicketResponse(ticketId, created.getTicketId(), created.getOwnerEmail());
    }

    @PatchMapping("/api/ticket/{ticketId}/status")
    public TicketResponse voidTicket(@PathVariable UUID ticketId, @Valid @RequestBody VoidTicketRequest request,
                                     @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        // An organizer may only void tickets of their own events; anything else looks like a missing ticket.
        UUID eventId = getTicketUseCase.getTicket(ticketId).getEventId();
        if (!access.canManage(eventId, jwt, authentication)) {
            throw new com.techie.microservices.ticketing.catalog.domain.exception.TicketNotFoundException(ticketId);
        }
        var ticket = voidTicketUseCase.voidTicket(new VoidTicketCommand(ticketId, request.status(), request.reason()));
        return TicketResponse.from(ticket);
    }

    @GetMapping("/api/event/{eventId}/tickets")
    public Page<TicketResponse> listTicketsForEvent(@PathVariable UUID eventId, Pageable pageable,
                                                    @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        // Managers see who holds what, never the holders' QR codes (a QR is the ticket).
        return listTicketsForEventUseCase.listTicketsForEvent(eventId, pageable).map(t -> TicketResponse.from(t).withoutQr());
    }
}
