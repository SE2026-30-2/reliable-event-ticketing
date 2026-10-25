package com.techie.microservices.ticketing.catalog.web;

import com.techie.microservices.ticketing.catalog.application.port.InviteGuestsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.InviteGuestsUseCase.Guest;
import com.techie.microservices.ticketing.catalog.application.port.InviteGuestsUseCase.InviteGuestsCommand;
import com.techie.microservices.ticketing.catalog.web.dto.TicketResponse;
import com.techie.microservices.ticketing.shared.web.AuthenticatedUser;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class GuestController {

    private final InviteGuestsUseCase inviteGuestsUseCase;
    private final ManagementAccess access;

    public record GuestRequest(@NotBlank @Size(max = 255) String name, @NotBlank @Email @Size(max = 255) String email) {
    }

    public record InviteGuestsRequest(@NotNull UUID ticketTypeId, @NotEmpty @Size(max = 200) List<@Valid GuestRequest> guests) {
    }

    /** ADMIN or the event's ORGANIZER: complimentary tickets for a guest list. */
    @PostMapping("/api/manage/events/{eventId}/guests")
    public ResponseEntity<List<TicketResponse>> inviteGuests(@PathVariable UUID eventId, @Valid @RequestBody InviteGuestsRequest request,
                                                             @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        var tickets = inviteGuestsUseCase.inviteGuests(new InviteGuestsCommand(eventId, request.ticketTypeId(),
                request.guests().stream().map(g -> new Guest(g.name(), g.email())).toList(), AuthenticatedUser.email(jwt)));
        return ResponseEntity.status(HttpStatus.CREATED).body(tickets.stream().map(t -> TicketResponse.from(t).withoutQr()).toList());
    }
}
