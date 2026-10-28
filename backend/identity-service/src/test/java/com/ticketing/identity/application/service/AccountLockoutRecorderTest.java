package com.ticketing.identity.application.service;

import com.ticketing.identity.application.port.UserRepositoryPort;
import com.ticketing.identity.domain.model.User;
import com.ticketing.identity.domain.model.UserStatus;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountLockoutRecorderTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    private AccountLockoutRecorder recorder;

    private User userWithAttempts(int attempts) {
        return User.builder()
                .id(UUID.randomUUID())
                .email("shopper@example.com")
                .passwordHash("hash")
                .fullName("Jane Shopper")
                .roles(Set.of("USER"))
                .status(UserStatus.ACTIVE)
                .failedLoginAttempts(attempts)
                .emailVerified(false)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    private void withMaxAttempts(int max) {
        recorder = new AccountLockoutRecorder(userRepositoryPort);
        ReflectionTestUtils.setField(recorder, "maxFailedLoginAttempts", max);
    }

    @Test
    void recordFailedAttempt_belowThreshold_incrementsWithoutLocking() {
        withMaxAttempts(5);
        User user = userWithAttempts(2);
        when(userRepositoryPort.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepositoryPort.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        recorder.recordFailedAttempt(user.getId());

        assertThat(user.getFailedLoginAttempts()).isEqualTo(3);
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void recordFailedAttempt_reachingThreshold_locksTheAccount() {
        withMaxAttempts(5);
        User user = userWithAttempts(4); // one more hits the configured max of 5
        when(userRepositoryPort.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepositoryPort.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        recorder.recordFailedAttempt(user.getId());

        assertThat(user.getFailedLoginAttempts()).isEqualTo(5);
        assertThat(user.getStatus()).isEqualTo(UserStatus.LOCKED);
    }

    @Test
    void recordFailedAttempt_unknownUserId_isSilentlyANoOp() {
        withMaxAttempts(5);
        UUID unknownId = UUID.randomUUID();
        when(userRepositoryPort.findById(unknownId)).thenReturn(Optional.empty());

        recorder.recordFailedAttempt(unknownId);
    }
}
