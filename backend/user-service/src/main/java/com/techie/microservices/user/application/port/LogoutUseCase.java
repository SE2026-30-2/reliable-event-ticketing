package com.techie.microservices.user.application.port;

/**
 * Revokes a single refresh token (the current session), ending it early instead of waiting for
 * its natural expiry. Silently a no-op if the token is already revoked/expired/unknown - logout
 * is idempotent by design, never a source of a user-visible error.
 */
public interface LogoutUseCase {

    void logout(String rawRefreshToken);
}
