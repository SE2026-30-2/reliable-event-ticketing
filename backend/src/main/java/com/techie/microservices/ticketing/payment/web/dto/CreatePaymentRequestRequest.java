package com.techie.microservices.ticketing.payment.web.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreatePaymentRequestRequest(
        @NotNull UUID reservationId,
        /** "COMPLETED"/"FAILED" to pin the outcome (demo/test hook); omit for the configured
         * random success rate. */
        String forceOutcome
) {
}
