package com.ticketing.identity.web;

import com.ticketing.identity.application.port.GetUserByIdUseCase;
import com.ticketing.identity.application.port.ListUsersUseCase;
import com.ticketing.identity.application.port.UpdateUserRolesUseCase;
import com.ticketing.identity.application.port.UpdateUserStatusUseCase;
import com.ticketing.identity.web.dto.UpdateRolesRequest;
import com.ticketing.identity.web.dto.UpdateStatusRequest;
import com.ticketing.identity.web.dto.UserResponse;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/**
 * ROLE_ADMIN-only user management - every route under /api/user/admin/** requires that authority
 * (see config.SecurityConfig), the same {@code roles} claim -> {@code ROLE_*} convention product-
 * service/inventory-service/review-promotion-service use for their own admin-gated routes.
 */
@RestController
@RequestMapping("/api/user/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final ListUsersUseCase listUsersUseCase;
    private final GetUserByIdUseCase getUserByIdUseCase;
    private final UpdateUserStatusUseCase updateUserStatusUseCase;
    private final UpdateUserRolesUseCase updateUserRolesUseCase;

    @GetMapping
    public Page<UserResponse> list(Pageable pageable) {
        return listUsersUseCase.list(pageable).map(UserResponse::from);
    }

    @GetMapping("/{id}")
    public UserResponse getById(@PathVariable UUID id) {
        return UserResponse.from(getUserByIdUseCase.getById(id));
    }

    @PatchMapping("/{id}/status")
    public UserResponse updateStatus(@PathVariable UUID id, @Valid @RequestBody UpdateStatusRequest request) {
        return UserResponse.from(updateUserStatusUseCase.updateStatus(id, request.status()));
    }

    @PatchMapping("/{id}/roles")
    public UserResponse updateRoles(@PathVariable UUID id, @Valid @RequestBody UpdateRolesRequest request) {
        return UserResponse.from(updateUserRolesUseCase.updateRoles(id, request.roles()));
    }
}
