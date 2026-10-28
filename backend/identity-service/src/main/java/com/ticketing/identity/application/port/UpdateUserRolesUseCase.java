package com.ticketing.identity.application.port;

import com.ticketing.identity.domain.model.User;
import java.util.Set;
import java.util.UUID;

/** ROLE_ADMIN only - replaces the account's role set wholesale (e.g. grant/revoke ADMIN). */
public interface UpdateUserRolesUseCase {

    User updateRoles(UUID id, Set<String> roles);
}
