package com.ticketing.catalog.web.dto;

import com.ticketing.catalog.domain.model.TicketStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record VoidTicketRequest(
        @NotNull TicketStatus status,
        @NotBlank String reason
) {
}
