package com.ticketing.identity.application.port;

import com.ticketing.identity.domain.model.RefreshToken;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepositoryPort {

    RefreshToken save(RefreshToken refreshToken);

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Used by ResetPasswordUseCase to kill every existing session on a password reset. */
    void revokeAllForUser(UUID userId);
}
