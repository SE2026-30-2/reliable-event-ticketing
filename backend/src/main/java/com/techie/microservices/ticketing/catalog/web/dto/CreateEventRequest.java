package com.techie.microservices.ticketing.catalog.web.dto;

import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateEventRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 255) String venue,
        @NotNull @Future Instant startsAt,
        @NotNull Instant endsAt,
        @Size(max = 5000) String description,
        @Size(max = 500) String bannerUrl,
        /** DRAFT (hidden until published) or PUBLISHED; omitted = PUBLISHED. */
        EventStatus status
) {
}
