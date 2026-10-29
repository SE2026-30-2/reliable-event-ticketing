package com.ticketing.identity.application.port;

/**
 * Verifies credentials and, on success, issues a fresh access/refresh token pair. On failure,
 * increments the account's failed-login counter and locks it once the configured threshold is
 * reached (see UserApplicationService#login) - both a wrong password and an unknown email raise
 * the same InvalidCredentialsException, so a caller can never distinguish "no such account" from
 * "wrong password".
 */
public interface LoginUseCase {

    AuthTokens login(LoginCommand command);
}
