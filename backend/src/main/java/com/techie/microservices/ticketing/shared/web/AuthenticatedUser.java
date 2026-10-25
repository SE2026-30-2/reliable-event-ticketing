package com.techie.microservices.ticketing.shared.web;

import com.techie.microservices.ticketing.catalog.domain.exception.EmailNotVerifiedException;
import com.techie.microservices.ticketing.shared.domain.Actor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/** Reads the caller's identity from the validated user-service JWT: {@code sub} is the account's
 * email (lower-cased here so ownership comparisons never depend on how it was typed). */
public final class AuthenticatedUser {

    private AuthenticatedUser() {
    }

    public static String email(Jwt jwt) {
        return jwt.getSubject().trim().toLowerCase();
    }

    public static boolean isOrganizer(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ORGANIZER".equals(a.getAuthority()));
    }

    /** Null when the request is anonymous (public endpoints that behave differently for managers). */
    public static Actor actor(Jwt jwt, Authentication authentication) {
        if (jwt == null) {
            return null;
        }
        return new Actor(email(jwt), isAdmin(authentication), isOrganizer(authentication));
    }

    /** Whether the account's email has been verified (claim added by user-service; absent = no). */
    public static boolean emailVerified(Jwt jwt) {
        return Boolean.TRUE.equals(jwt.getClaim("email_verified"));
    }

    /** Buying requires a verified email unless disabled (demo/dev) - see ticketing.require-verified-email. */
    public static void requireVerifiedEmail(Jwt jwt, boolean required) {
        if (required && !emailVerified(jwt)) {
            throw new EmailNotVerifiedException();
        }
    }

    public static boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
