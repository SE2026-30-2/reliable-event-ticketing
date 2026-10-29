package com.ticketing.identity.application.port;

/**
 * Exchanges a still-valid, not-yet-revoked refresh token for a brand new access/refresh pair.
 * The presented refresh token is revoked as part of the exchange (rotation) - see
 * UserApplicationService#refresh - so a stolen-and-replayed refresh token can only ever be
 * redeemed once.
 */
public interface RefreshAccessTokenUseCase {

    AuthTokens refresh(String rawRefreshToken);
}
