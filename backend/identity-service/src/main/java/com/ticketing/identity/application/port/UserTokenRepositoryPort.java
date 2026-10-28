package com.ticketing.identity.application.port;

import com.ticketing.identity.domain.model.UserToken;
import com.ticketing.identity.domain.model.UserTokenType;
import java.util.Optional;
import java.util.UUID;

public interface UserTokenRepositoryPort {

    UserToken save(UserToken token);

    Optional<UserToken> findByTokenHashAndType(String tokenHash, UserTokenType type);

    /**
     * Invalidates every not-yet-used token of this type for this user, so a fresh
     * request-verification/forgot-password call can never leave more than one live token behind
     * (an old, still-unexpired one silently redeemable alongside the new one).
     */
    void invalidateAllForUser(UUID userId, UserTokenType type);
}
