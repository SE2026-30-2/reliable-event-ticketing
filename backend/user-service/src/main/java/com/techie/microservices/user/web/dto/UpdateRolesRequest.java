package com.techie.microservices.user.web.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.Set;

public record UpdateRolesRequest(
        @NotEmpty(message = "roles must not be empty")
        Set<@Pattern(regexp = "USER|ADMIN|ORGANIZER", message = "roles must be USER, ADMIN or ORGANIZER") String> roles
) {
}
