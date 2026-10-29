package com.techie.microservices.ticketing.shared.web.error;

import org.springframework.http.HttpStatus;

import java.time.Instant;

/**
 * Structured error body returned by {@link GlobalExceptionHandler}.
 */
public record ErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String message
) {
    public static ErrorResponse of(HttpStatus status, String message) {
        return new ErrorResponse(Instant.now(), status.value(), status.getReasonPhrase(), message);
    }
}
