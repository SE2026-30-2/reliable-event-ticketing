package com.techie.microservices.user.web.dto;

import com.techie.microservices.user.domain.model.User;
import com.techie.microservices.user.domain.model.UserStatus;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * Response body for register/me/admin-user endpoints. The frontend only ever renders email/
 * fullName, but reads every other field defensively (see frontend/src/api/types.ts's
 * UserProfile) - this shape (id, email, fullName, roles, status, failedLoginAttempts,
 * emailVerified, createdAt) is the one that comment describes reading from source.
 */
public record UserResponse(
        UUID id,
        String email,
        String fullName,
        Set<String> roles,
        UserStatus status,
        int failedLoginAttempts,
        boolean emailVerified,
        Instant createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRoles(),
                user.getStatus(),
                user.getFailedLoginAttempts(),
                user.isEmailVerified(),
                user.getCreatedAt()
        );
    }
}
