package com.ticketing.identity.web.error;

import java.util.List;

/**
 * This service's error body shape - deliberately {@code {message, details}} rather than the
 * {@link org.springframework.http.ProblemDetail} shape used by cart/product/payment/
 * review-promotion-service, or order-service/inventory-service's own custom shapes. The frontend's
 * api/client.ts error-message extractor special-cases exactly this {@code {message, details:
 * string[]}} shape for this service, so it must not be changed without updating that extractor.
 */
public record ErrorResponse(String message, List<String> details) {

    public static ErrorResponse of(String message) {
        return new ErrorResponse(message, List.of());
    }

    public static ErrorResponse of(String message, List<String> details) {
        return new ErrorResponse(message, details);
    }
}
