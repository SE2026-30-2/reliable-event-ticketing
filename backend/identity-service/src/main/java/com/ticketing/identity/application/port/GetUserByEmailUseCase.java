package com.ticketing.identity.application.port;

import com.ticketing.identity.domain.model.User;

/**
 * Backs GET /api/user/me: the caller's identity is the JWT subject (email), never a
 * client-supplied id - see web.UserController.
 */
public interface GetUserByEmailUseCase {

    User getByEmail(String email);
}
