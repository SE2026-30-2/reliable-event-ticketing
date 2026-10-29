package com.techie.microservices.user.application.port;

import com.techie.microservices.user.domain.model.User;
import java.util.UUID;

/** ROLE_ADMIN only - see web.AdminUserController. */
public interface GetUserByIdUseCase {

    User getById(UUID id);
}
