package com.techie.microservices.ticketing.checkin.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public record SubmitCheckinRequest(
        @NotBlank String qrPayload,
        @NotNull UUID idempotencyKey,
        @NotNull Instant clientCheckinAt
) {
}
