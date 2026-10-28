package com.ticketing.identity.domain.model;

import java.time.Instant;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A single-use, hashed, expiring token backing both the email-verification and password-reset
 * flows (discriminated by {@link #type}). Only the SHA-256 hash of the raw token mailed to the
 * user is ever persisted - see infrastructure.security.Sha256TokenHashingAdapter.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserToken {

    private UUID id;
    private UUID userId;
    private String tokenHash;
    private UserTokenType type;
    private Instant expiresAt;
    private Instant usedAt;
    private Instant createdAt;

    public boolean isUsable(Instant now) {
        return usedAt == null && expiresAt.isAfter(now);
    }
}
