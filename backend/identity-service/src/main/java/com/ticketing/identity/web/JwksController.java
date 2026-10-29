package com.ticketing.identity.web;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.ticketing.identity.infrastructure.security.RsaKeyProvider;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/**
 * Serves this service's own public signing key as a standard JWK Set at the well-known path every
 * other service's {@code NimbusJwtDecoder} points at ({@code security.jwt.jwk-set-uri}, default
 * {@code http://localhost:8087/.well-known/jwks.json}) - this is the only way another service can
 * validate a JWT issued here, since there is no shared secret between services. Deliberately not
 * under {@code /api/user} and left {@code permitAll} in SecurityConfig: every other service fetches
 * it unauthenticated, often before it has ever seen a token to authenticate itself with.
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
