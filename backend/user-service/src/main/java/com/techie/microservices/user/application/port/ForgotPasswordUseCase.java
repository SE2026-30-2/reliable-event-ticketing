package com.techie.microservices.user.application.port;

/**
 * Issues a password-reset token and writes an outbox row asking notification-service to mail it.
 * Always succeeds from the caller's point of view (returns void, no "email not found" signal) so
 * this endpoint can never be used to enumerate registered emails.
 */
public interface ForgotPasswordUseCase {

    void requestReset(String email);
}
