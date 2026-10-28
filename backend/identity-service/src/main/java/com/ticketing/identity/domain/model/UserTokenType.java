package com.ticketing.identity.domain.model;

/**
 * Discriminator for the single {@code user_tokens} table, which backs two unrelated single-use
 * flows that otherwise have an identical shape (a hashed opaque token with an expiry and a
 * used-at marker) - see UserToken.
 */
public enum UserTokenType {
    EMAIL_VERIFICATION,
    PASSWORD_RESET
}
