package com.ticketing.identity.application.port;

/**
 * Redeems a single-use password-reset token: sets the new password, resets the failed-login
 * counter and clears a LOCKED status (successfully resetting the password is proof of control
 * over the account's email, the same signal an admin unlock would otherwise require), and revokes
 * every existing refresh token for the account so any session on a previously-compromised
 * password is invalidated.
 */
public interface ResetPasswordUseCase {

    void reset(String rawToken, String newPassword);
}
