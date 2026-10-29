package com.ticketing.identity.application.port;

import com.ticketing.identity.domain.model.User;

/**
 * Output port hiding the RS256/JWT mechanics from the application layer - see
 * infrastructure.security.JwtAccessTokenIssuer, the only implementation. The subject is the
 * user's email and the {@code roles} claim carries the plain role names (no {@code ROLE_} prefix -
 * every resource-server service adds that prefix itself via its own JwtGrantedAuthoritiesConverter).
 */
public interface AccessTokenIssuerPort {

    IssuedAccessToken issue(User user);
}
