package com.techie.microservices.user.web.dto;

import com.techie.microservices.user.domain.model.UserStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateStatusRequest(
        @NotNull(message = "status is required") UserStatus status
) {
}
