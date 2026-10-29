package com.ticketing.identity.application.port;

import com.ticketing.identity.domain.model.User;

/**
 * Creates the account (role USER, status ACTIVE, emailVerified false) and, in the same
 * transaction, writes an outbox row that will ask notification-service to send a verification
 * email - see UserApplicationService#register. Does not itself return any token: the frontend
 * calls POST /api/user/login immediately after a successful registration.
 */
public interface RegisterUserUseCase {

    User register(RegisterUserCommand command);
}
