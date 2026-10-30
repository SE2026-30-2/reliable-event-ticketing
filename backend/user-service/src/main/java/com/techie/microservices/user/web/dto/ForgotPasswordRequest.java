package com.techie.microservices.user.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(
        @NotBlank(message = "email is required") @Email(message = "email must be a valid email address") String email
) {
}
