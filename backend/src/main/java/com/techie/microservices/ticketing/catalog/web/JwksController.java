package com.techie.microservices.ticketing.catalog.web;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.techie.microservices.ticketing.catalog.infrastructure.security.RsaKeyProvider;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/**
 * Serves this service's own QR-signing public key as a standard JWK Set - the only way
 * checkin-service (or any other verifier) can validate a ticket's signed QR payload, since there
 * is no shared secret. Unauthenticated and outside {@code /api/**}, same convention as
 * user-service's own {@code JwksController} (a separate signing domain from user-service's JWKS -
 * this key only ever signs QR payloads, never an operator/admin JWT).
 */
@RestController
@RequiredArgsConstructor
public class JwksController {

    private final RsaKeyProvider rsaKeyProvider;

    @GetMapping("/.well-known/jwks.json")
    public Map<String, Object> jwks() {
        RSAKey rsaKey = new RSAKey.Builder(rsaKeyProvider.getPublicKey())
                .keyID(RsaKeyProvider.KEY_ID)
                .build();
        return new JWKSet(rsaKey).toJSONObject();
    }
}
