package com.ticketing.identity.web.dto;

import com.ticketing.identity.domain.model.UserStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateStatusRequest(
        @NotNull(message = "status is required") UserStatus status
) {
}
