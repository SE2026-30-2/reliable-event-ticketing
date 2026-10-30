package com.techie.microservices.ticketing.catalog.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TransferTicketRequest(
        /** The recipient's account email - they see the ticket in My Tickets after signing in with it. */
        @NotBlank @Email @Size(max = 255) String toEmail,
        @Size(max = 255) String holderName
) {
}
