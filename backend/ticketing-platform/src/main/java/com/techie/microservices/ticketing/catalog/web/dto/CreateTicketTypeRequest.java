package com.techie.microservices.ticketing.catalog.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.Instant;

public record CreateTicketTypeRequest(
        @NotBlank String name,
        @PositiveOrZero long priceCents,
        @Min(1) int quota,
        @NotNull Instant validFrom,
        @NotNull Instant validUntil,
        /** Scans allowed per ticket (a 2-day pass = 2); omitted = 1. */
        @Min(1) @Max(50) Integer maxEntries,
        /** Tickets sold together per unit (a pack of 4 at one price = 4); omitted = 1. */
        @Min(1) @Max(20) Integer bundleSize
) {
}
