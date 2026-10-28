package com.ticketing.identity.application.port;

/**
 * (Re)issues an email-verification token for the given account and writes an outbox row asking
 * notification-service to mail it. Silently a no-op if the account is already verified or does
 * not exist - never reveals account existence to the caller.
 */
public interface RequestEmailVerificationUseCase {

    void requestVerification(String email);
}
