package com.ticketing.identity.infrastructure.security;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.ticketing.identity.application.port.AccessTokenIssuerPort;
import com.ticketing.identity.application.port.IssuedAccessToken;
import com.ticketing.identity.domain.model.User;

import java.time.Instant;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

/**
 * The only {@link AccessTokenIssuerPort} implementation: signs an RS256 JWT with this service's
 * own private key (see {@link RsaKeyProvider}) - no shared secret with any other service, which
 * instead validate the signature via the public key served at GET /.well-known/jwks.json. The
 * subject is the user's email (every downstream service that reads {@code jwt.getSubject()} - see
 * cart-service's CartController - treats it as the account identity) and the {@code roles} claim
 * carries plain role names (no {@code ROLE_} prefix; each resource-server service prefixes it
 * itself via its own {@code JwtGrantedAuthoritiesConverter}, e.g. product-service's SecurityConfig).
 */
@Component
public class JwtAccessTokenIssuer implements AccessTokenIssuerPort {

    private final JwtEncoder jwtEncoder;
    private final String issuer;
    private final long accessTokenTtlSeconds;

    public JwtAccessTokenIssuer(RsaKeyProvider rsaKeyProvider,
                                 @Value("${security.jwt.issuer}") String issuer,
                                 @Value("${security.jwt.access-token-ttl-seconds}") long accessTokenTtlSeconds) {
        RSAKey rsaKey = new RSAKey.Builder(rsaKeyProvider.getPublicKey())
                .privateKey(rsaKeyProvider.getPrivateKey())
                .keyID(RsaKeyProvider.KEY_ID)
                .build();
        this.jwtEncoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(rsaKey)));
        this.issuer = issuer;
        this.accessTokenTtlSeconds = accessTokenTtlSeconds;
    }

    @Override
    public IssuedAccessToken issue(User user) {
        Instant now = Instant.now();
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).keyId(RsaKeyProvider.KEY_ID).build();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(accessTokenTtlSeconds))
                .subject(user.getEmail())
                .claim("roles", List.copyOf(user.getRoles()))
                // Lets resource servers require a verified email (e.g. before buying) with no call back here.
                .claim("email_verified", user.isEmailVerified())
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedAccessToken(token, accessTokenTtlSeconds);
    }
}
