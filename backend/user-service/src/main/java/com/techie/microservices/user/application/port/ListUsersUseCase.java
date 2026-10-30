package com.techie.microservices.user.application.port;

import com.techie.microservices.user.domain.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** ROLE_ADMIN only - see web.AdminUserController. */
public interface ListUsersUseCase {

    Page<User> list(Pageable pageable);
}
