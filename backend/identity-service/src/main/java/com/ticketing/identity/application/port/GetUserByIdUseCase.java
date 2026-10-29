package com.ticketing.identity.application.port;

import com.ticketing.identity.domain.model.User;
import java.util.UUID;

/** ROLE_ADMIN only - see web.AdminUserController. */
public interface GetUserByIdUseCase {

    User getById(UUID id);
}
