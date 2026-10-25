package com.techie.microservices.ticketing.catalog.web;

import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListTicketTypesForEventUseCase;
import com.techie.microservices.ticketing.catalog.web.dto.CreateTicketTypeRequest;
import com.techie.microservices.ticketing.catalog.application.port.GetEventUseCase;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import com.techie.microservices.ticketing.catalog.web.dto.TicketTypeResponse;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/event/{eventId}/ticket-types")
@RequiredArgsConstructor
public class TicketTypeController {

    private final CreateTicketTypeUseCase createTicketTypeUseCase;
    private final ListTicketTypesForEventUseCase listTicketTypesForEventUseCase;
    private final GetEventUseCase getEventUseCase;
    private final ManagementAccess access;

    @PostMapping
    public ResponseEntity<TicketTypeResponse> createTicketType(@PathVariable UUID eventId,
                                                                @Valid @RequestBody CreateTicketTypeRequest request,
                                                                @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        var ticketType = createTicketTypeUseCase.createTicketType(new CreateTicketTypeCommand(
                eventId, request.name(), request.priceCents(), request.quota(), request.validFrom(), request.validUntil(),
                request.maxEntries() == null ? 1 : request.maxEntries(),
                request.bundleSize() == null ? 1 : request.bundleSize()));
        return ResponseEntity.status(HttpStatus.CREATED).body(TicketTypeResponse.from(ticketType));
    }

    @GetMapping
    public List<TicketTypeResponse> listTicketTypes(@PathVariable UUID eventId, @AuthenticationPrincipal Jwt jwt,
                                                    Authentication authentication) {
        if (getEventUseCase.getEvent(eventId).getStatus() != EventStatus.PUBLISHED && !access.canManage(eventId, jwt, authentication)) {
            throw new EventNotFoundException(eventId);
        }
        return listTicketTypesForEventUseCase.listTicketTypesForEvent(eventId).stream()
                .map(TicketTypeResponse::from)
                .toList();
    }
}
