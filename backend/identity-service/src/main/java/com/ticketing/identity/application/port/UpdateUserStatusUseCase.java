package com.ticketing.identity.application.port;

import com.ticketing.identity.domain.model.User;
import com.ticketing.identity.domain.model.UserStatus;
import java.util.UUID;

/**
 * ROLE_ADMIN only - manual lock/unlock. Setting status back to ACTIVE also resets the failed-login
 * counter, matching what a successful password reset does, so an admin unlock is never immediately
 * re-locked by the same stale attempt count.
 */
public interface UpdateUserStatusUseCase {

    User updateStatus(UUID id, UserStatus status);
}
