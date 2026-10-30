package com.techie.microservices.ticketing.checkin.infrastructure.security;

import org.springframework.stereotype.Component;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Device credentials are a symmetric API key, not a JWT - a device is a piece of equipment, not a
 * user-service account, so there is nothing to issue it an asymmetric-signed token for. Only the
 * SHA-256 hash is ever persisted; the plaintext exists only in the HTTP response of the
 * registration call and on the device itself.
 */
@Component
public class ApiKeyHasher {

    private static final int KEY_BYTES = 32;
    private static final Base64.Encoder BASE64_URL_NO_PAD = Base64.getUrlEncoder().withoutPadding();
    private final SecureRandom secureRandom = new SecureRandom();

    public String generate() {
        byte[] bytes = new byte[KEY_BYTES];
        secureRandom.nextBytes(bytes);
        return BASE64_URL_NO_PAD.encodeToString(bytes);
    }

    public String hash(String plaintextApiKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(plaintextApiKey.getBytes());
            return BASE64_URL_NO_PAD.encodeToString(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
