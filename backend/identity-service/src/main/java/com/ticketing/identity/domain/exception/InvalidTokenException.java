package com.ticketing.identity.domain.exception;

/**
 * Thrown for a refresh/verification/password-reset token that is missing, already used, expired,
 * or otherwise does not resolve to a usable UserToken/RefreshToken row.
 */
public class InvalidTokenException extends RuntimeException {
    public InvalidTokenException(String message) {
        super(message);
    }
}
