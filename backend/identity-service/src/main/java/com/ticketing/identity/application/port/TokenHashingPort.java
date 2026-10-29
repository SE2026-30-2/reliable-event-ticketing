package com.ticketing.identity.application.port;

/**
 * Output port for the opaque-token mechanics shared by refresh tokens, email-verification tokens
 * and password-reset tokens: a cryptographically random raw token is generated and handed to the
 * client/mailed to the user, while only its hash is ever persisted (see
 * infrastructure.security.Sha256TokenHashingAdapter, the only implementation) - a stolen database
 * dump alone can never be replayed as a valid token.
 */
public interface TokenHashingPort {

    String generateRawToken();

    String hash(String rawToken);
}
