package com.techie.microservices.user.domain.model;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The aggregate root this whole service exists to manage. Framework-free - no JPA/persistence
 * annotations here (see infrastructure.persistence.UserEntity for the JPA mapping); the mapping
 * between the two happens in UserRepositoryAdapter.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    private UUID id;
    private String email;
    private String passwordHash;
    private String fullName;

    @Builder.Default
    private Set<String> roles = new HashSet<>();

    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;

    @Builder.Default
    private int failedLoginAttempts = 0;

    @Builder.Default
    private boolean emailVerified = false;

    private Instant createdAt;
    private Instant updatedAt;

    public boolean isLocked() {
        return status == UserStatus.LOCKED;
    }
}
