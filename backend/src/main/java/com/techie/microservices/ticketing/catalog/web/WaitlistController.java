package com.techie.microservices.ticketing.catalog.web;

import com.techie.microservices.ticketing.catalog.application.port.WaitlistUseCase;
import com.techie.microservices.ticketing.catalog.application.port.WaitlistUseCase.JoinWaitlistCommand;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistEntry;
import com.techie.microservices.ticketing.shared.web.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Any signed-in buyer (verified email required, like reserving). Entries belong to the JWT subject. */
@RestController
@RequiredArgsConstructor
public class WaitlistController {

    private final WaitlistUseCase waitlistUseCase;

    @Value("${ticketing.require-verified-email:true}")
    private boolean requireVerifiedEmail;

    public record JoinWaitlistRequest(@Min(1) @Max(10) int quantity, @NotBlank String holderName, @NotBlank @Email String holderEmail) {
    }

    public record WaitlistEntryResponse(UUID entryId, UUID ticketTypeId, int quantity, String status, UUID reservationId,
                                        String failureReason, Instant offeredAt, Instant createdAt) {
        static WaitlistEntryResponse from(WaitlistEntry e) {
            return new WaitlistEntryResponse(e.getEntryId(), e.getTicketTypeId(), e.getQuantity(), e.getStatus().name(),
                    e.getReservationId(), e.getFailureReason(), e.getOfferedAt(), e.getCreatedAt());
        }
    }

    @PostMapping("/api/ticket-types/{ticketTypeId}/waitlist")
    public ResponseEntity<WaitlistEntryResponse> join(@PathVariable UUID ticketTypeId, @Valid @RequestBody JoinWaitlistRequest request,
                                                      @AuthenticationPrincipal Jwt jwt) {
        AuthenticatedUser.requireVerifiedEmail(jwt, requireVerifiedEmail);
        var entry = waitlistUseCase.join(new JoinWaitlistCommand(AuthenticatedUser.email(jwt), ticketTypeId,
                request.quantity(), request.holderName(), request.holderEmail()));
        return ResponseEntity.status(HttpStatus.CREATED).body(WaitlistEntryResponse.from(entry));
    }

    @GetMapping("/api/my/waitlist")
    public List<WaitlistEntryResponse> mine(@AuthenticationPrincipal Jwt jwt) {
        return waitlistUseCase.listMine(AuthenticatedUser.email(jwt)).stream().map(WaitlistEntryResponse::from).toList();
    }

    @DeleteMapping("/api/waitlist/{entryId}")
    public WaitlistEntryResponse leave(@PathVariable UUID entryId, @AuthenticationPrincipal Jwt jwt) {
        return WaitlistEntryResponse.from(waitlistUseCase.leave(entryId, AuthenticatedUser.email(jwt)));
    }
}
