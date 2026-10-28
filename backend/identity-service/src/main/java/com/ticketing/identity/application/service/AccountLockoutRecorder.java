package com.ticketing.identity.application.service;

import com.ticketing.identity.application.port.UserRepositoryPort;
import com.ticketing.identity.domain.model.UserStatus;

import java.time.Instant;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Persists a failed-login attempt in its OWN transaction ({@code REQUIRES_NEW}), committed before
 * control returns to the caller. This is deliberately split out of
 * {@link UserApplicationService#login}: that method is itself {@code @Transactional}, and it
 * throws {@code InvalidCredentialsException} right after recording the failure - left inline, the
 * default rollback-on-RuntimeException behavior would roll back the whole method's transaction,
 * silently discarding the very attempt-count increment the exception was meant to leave behind.
 * {@code REQUIRES_NEW} only takes effect through Spring's proxy, which is why this has to be a
 * separate bean rather than a private/self-invoked method on {@code UserApplicationService}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountLockoutRecorder {

    private final UserRepositoryPort userRepositoryPort;

    @Value("${security.account.max-failed-login-attempts}")
    private int maxFailedLoginAttempts;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailedAttempt(UUID userId) {
        userRepositoryPort.findById(userId).ifPresent(user -> {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= maxFailedLoginAttempts) {
                user.setStatus(UserStatus.LOCKED);
                log.warn("User {} locked after {} consecutive failed login attempts", user.getEmail(), attempts);
            }
            user.setUpdatedAt(Instant.now());
            userRepositoryPort.save(user);
        });
    }
}
