package com.techie.microservices.user.infrastructure.security;

import com.techie.microservices.user.application.port.TokenHashingPort;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

import org.springframework.stereotype.Component;

/**
 * The only {@link TokenHashingPort} implementation. Raw tokens are 256 bits of {@link
 * SecureRandom} output, URL-safe base64 encoded so they drop straight into a query string/email
 * link with no further escaping. Only {@link #hash(String)} is ever persisted (refresh_tokens /
 * user_tokens' token_hash columns) - a stolen database dump alone can never be replayed as a valid
 * token.
 */
@Component
public class Sha256TokenHashingAdapter implements TokenHashingPort {

    private static final int RAW_TOKEN_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    public String generateRawToken() {
        byte[] bytes = new byte[RAW_TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @Override
    public String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
