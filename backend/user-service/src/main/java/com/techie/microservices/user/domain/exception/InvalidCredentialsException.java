package com.techie.microservices.user.domain.exception;

/**
 * Thrown for both "no such user" and "wrong password" - deliberately the same exception/message
 * for both, so a login failure never reveals whether the email itself is registered.
 */
public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException(String message) {
        super(message);
    }
}
