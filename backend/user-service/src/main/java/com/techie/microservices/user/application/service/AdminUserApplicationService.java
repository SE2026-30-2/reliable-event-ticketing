package com.techie.microservices.user.application.service;

import com.techie.microservices.user.application.port.GetUserByIdUseCase;
import com.techie.microservices.user.application.port.ListUsersUseCase;
import com.techie.microservices.user.application.port.RefreshTokenRepositoryPort;
import com.techie.microservices.user.application.port.UpdateUserRolesUseCase;
import com.techie.microservices.user.application.port.UpdateUserStatusUseCase;
import com.techie.microservices.user.application.port.UserRepositoryPort;
import com.techie.microservices.user.domain.exception.UserNotFoundException;
import com.techie.microservices.user.domain.model.User;
import com.techie.microservices.user.domain.model.UserStatus;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Implements every ROLE_ADMIN-gated user-management use case - see web.AdminUserController for
 * the access rule (SecurityConfig requires ROLE_ADMIN on the whole /api/user/admin/** path).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminUserApplicationService implements
        ListUsersUseCase, GetUserByIdUseCase, UpdateUserStatusUseCase, UpdateUserRolesUseCase {

    private final UserRepositoryPort userRepositoryPort;
    private final RefreshTokenRepositoryPort refreshTokenRepositoryPort;

    @Override
    public Page<User> list(Pageable pageable) {
        return userRepositoryPort.findAll(pageable);
    }

    @Override
    public User getById(UUID id) {
        return userRepositoryPort.findById(id)
                .orElseThrow(() -> new UserNotFoundException("No user with id " + id));
    }

    @Override
    @Transactional
    public User updateStatus(UUID id, UserStatus status) {
        User user = getById(id);
        user.setStatus(status);
        if (status == UserStatus.ACTIVE) {
            user.setFailedLoginAttempts(0);
        } else {
            // Locking an account should also kill any session already in flight, not just block
            // future logins.
            refreshTokenRepositoryPort.revokeAllForUser(id);
        }
        user.setUpdatedAt(Instant.now());
        User saved = userRepositoryPort.save(user);
        log.info("Admin set user {} status to {}", saved.getEmail(), status);
        return saved;
    }

    @Override
    @Transactional
    public User updateRoles(UUID id, Set<String> roles) {
        User user = getById(id);
        user.setRoles(new HashSet<>(roles));
        user.setUpdatedAt(Instant.now());
        User saved = userRepositoryPort.save(user);
        log.info("Admin set user {} roles to {}", saved.getEmail(), roles);
        return saved;
    }
}
