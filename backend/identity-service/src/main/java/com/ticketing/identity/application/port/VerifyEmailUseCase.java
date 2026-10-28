package com.ticketing.identity.application.port;

/**
 * Redeems a single-use email-verification token, marking it used and flipping the account's
 * emailVerified flag to true. Never blocks login - see UserApplicationService#login - this is
 * purely informational (UserResponse#emailVerified) until/unless a future feature decides to gate
 * on it.
 */
public interface VerifyEmailUseCase {

    void verify(String rawToken);
}
