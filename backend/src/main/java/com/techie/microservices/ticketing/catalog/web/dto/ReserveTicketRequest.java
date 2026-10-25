package com.techie.microservices.ticketing.catalog.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReserveTicketRequest(
        @Min(1) @Max(10) int quantity,
        @NotBlank String holderName,
        @NotBlank @Email String holderEmail,
        @Size(max = 40) String couponCode
) {
}
