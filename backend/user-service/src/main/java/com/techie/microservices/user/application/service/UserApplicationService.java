package com.techie.microservices.user.application.service;

import com.techie.microservices.user.application.port.AccessTokenIssuerPort;
import com.techie.microservices.user.application.port.AuthTokens;
import com.techie.microservices.user.application.port.ForgotPasswordUseCase;
import com.techie.microservices.user.application.port.GetUserByEmailUseCase;
import com.techie.microservices.user.application.port.IssuedAccessToken;
import com.techie.microservices.user.application.port.LoginCommand;
import com.techie.microservices.user.application.port.LoginUseCase;
import com.techie.microservices.user.application.port.LogoutUseCase;
import com.techie.microservices.user.application.port.OutboxEventPublisherPort;
import com.techie.microservices.user.application.port.RefreshAccessTokenUseCase;
import com.techie.microservices.user.application.port.RefreshTokenRepositoryPort;
import com.techie.microservices.user.application.port.RegisterUserCommand;
import com.techie.microservices.user.application.port.RegisterUserUseCase;
import com.techie.microservices.user.application.port.RequestEmailVerificationUseCase;
import com.techie.microservices.user.application.port.ResetPasswordUseCase;
import com.techie.microservices.user.application.port.TokenHashingPort;
import com.techie.microservices.user.application.port.UserRepositoryPort;
import com.techie.microservices.user.application.port.UserTokenRepositoryPort;
import com.techie.microservices.user.application.port.VerifyEmailUseCase;
import com.techie.microservices.user.domain.exception.AccountLockedException;
import com.techie.microservices.user.domain.exception.EmailAlreadyRegisteredException;
import com.techie.microservices.user.domain.exception.InvalidCredentialsException;
import com.techie.microservices.user.domain.exception.InvalidTokenException;
import com.techie.microservices.user.domain.exception.UserNotFoundException;
import com.techie.microservices.user.domain.model.RefreshToken;
import com.techie.microservices.user.domain.model.User;
import com.techie.microservices.user.domain.model.UserStatus;
import com.techie.microservices.user.domain.model.UserToken;
import com.techie.microservices.user.domain.model.UserTokenType;
import com.techie.microservices.user.infrastructure.messaging.dto.EmailVerificationRequestedEvent;
import com.techie.microservices.user.infrastructure.messaging.dto.PasswordResetRequestedEvent;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Implements every account-lifecycle / authentication use case: register, login (with failed-
 * attempt lockout), refresh-token rotation, logout, self email-verification and forgot/reset
 * password. Depends only on output ports (repositories, the JWT issuer, the outbox publisher,
 * token hashing) - never on a JPA repository or the Kafka template directly, matching the
 * hexagonal style used across every other service in this repo (e.g.
 * payment.application.service.PaymentApplicationService).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserApplicationService implements
        RegisterUserUseCase, LoginUseCase, RefreshAccessTokenUseCase, LogoutUseCase,
        GetUserByEmailUseCase, RequestEmailVerificationUseCase, VerifyEmailUseCase,
        ForgotPasswordUseCase, ResetPasswordUseCase {

    private static final String ROLE_USER = "USER";
    private static final Duration EMAIL_VERIFICATION_TTL = Duration.ofHours(24);
    private static final Duration PASSWORD_RESET_TTL = Duration.ofHours(1);

    private final UserRepositoryPort userRepositoryPort;
    private final RefreshTokenRepositoryPort refreshTokenRepositoryPort;
    private final UserTokenRepositoryPort userTokenRepositoryPort;
    private final OutboxEventPublisherPort outboxEventPublisherPort;
    private final AccessTokenIssuerPort accessTokenIssuerPort;
    private final TokenHashingPort tokenHashingPort;
    private final PasswordEncoder passwordEncoder;
    private final AccountLockoutRecorder accountLockoutRecorder;

    @Value("${security.jwt.refresh-token-ttl-seconds}")
    private long refreshTokenTtlSeconds;

    @Value("${kafka.topic.email-verification-requested}")
    private String emailVerificationTopic;

    @Value("${kafka.topic.password-reset-requested}")
    private String passwordResetTopic;

    @Override
    @Transactional
    public User register(RegisterUserCommand command) {
        String email = normalizeEmail(command.email());
        if (userRepositoryPort.existsByEmail(email)) {
            throw new EmailAlreadyRegisteredException("An account with this email already exists");
        }

        Instant now = Instant.now();
        User user = User.builder()
                .id(UUID.randomUUID())
                .email(email)
                .passwordHash(passwordEncoder.encode(command.rawPassword()))
                .fullName(command.fullName())
                .roles(new HashSet<>(Set.of(ROLE_USER)))
                .status(UserStatus.ACTIVE)
                .failedLoginAttempts(0)
                .emailVerified(false)
                .createdAt(now)
                .updatedAt(now)
                .build();

        User saved = userRepositoryPort.save(user);
        issueEmailVerificationToken(saved);
        log.info("Registered new user id={} email={}", saved.getId(), saved.getEmail());
        return saved;
    }

    @Override
    @Transactional
    public AuthTokens login(LoginCommand command) {
        String email = normalizeEmail(command.email());
        User user = userRepositoryPort.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (user.isLocked()) {
            throw new AccountLockedException("This account is locked due to too many failed login attempts");
        }

        if (!passwordEncoder.matches(command.rawPassword(), user.getPasswordHash())) {
            // Recorded in its own transaction (see AccountLockoutRecorder's Javadoc) - this
            // method's own transaction is about to roll back along with the exception below.
            accountLockoutRecorder.recordFailedAttempt(user.getId());
            throw new InvalidCredentialsException("Invalid email or password");
        }

        if (user.getFailedLoginAttempts() > 0) {
            user.setFailedLoginAttempts(0);
            user.setUpdatedAt(Instant.now());
            user = userRepositoryPort.save(user);
        }

        log.info("User {} logged in", user.getEmail());
        return issueAuthTokens(user);
    }

    @Override
    @Transactional
    public AuthTokens refresh(String rawRefreshToken) {
        RefreshToken existing = refreshTokenRepositoryPort.findByTokenHash(tokenHashingPort.hash(rawRefreshToken))
                .filter(rt -> rt.isActive(Instant.now()))
                .orElseThrow(() -> new InvalidTokenException("Refresh token is invalid or expired"));

        User user = userRepositoryPort.findById(existing.getUserId())
                .orElseThrow(() -> new InvalidTokenException("Refresh token is invalid or expired"));

        if (user.isLocked()) {
            throw new AccountLockedException("This account is locked due to too many failed login attempts");
        }

        // Rotation: the presented refresh token is revoked as part of the exchange, so it can
        // only ever be redeemed once - a stolen-and-replayed token fails on its second use.
        existing.setRevokedAt(Instant.now());
        refreshTokenRepositoryPort.save(existing);

        return issueAuthTokens(user);
    }

    @Override
    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenRepositoryPort.findByTokenHash(tokenHashingPort.hash(rawRefreshToken))
                .filter(rt -> rt.getRevokedAt() == null)
                .ifPresent(rt -> {
                    rt.setRevokedAt(Instant.now());
                    refreshTokenRepositoryPort.save(rt);
                });
    }

    @Override
    public User getByEmail(String email) {
        return userRepositoryPort.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new UserNotFoundException("No such user"));
    }

    @Override
    @Transactional
    public void requestVerification(String email) {
        userRepositoryPort.findByEmail(normalizeEmail(email))
                .filter(user -> !user.isEmailVerified())
                .ifPresent(this::issueEmailVerificationToken);
    }

    @Override
    @Transactional
    public void verify(String rawToken) {
        UserToken token = userTokenRepositoryPort
                .findByTokenHashAndType(tokenHashingPort.hash(rawToken), UserTokenType.EMAIL_VERIFICATION)
                .filter(t -> t.isUsable(Instant.now()))
                .orElseThrow(() -> new InvalidTokenException("Verification link is invalid or expired"));

        User user = userRepositoryPort.findById(token.getUserId())
                .orElseThrow(() -> new InvalidTokenException("Verification link is invalid or expired"));

        token.setUsedAt(Instant.now());
        userTokenRepositoryPort.save(token);

        user.setEmailVerified(true);
        user.setUpdatedAt(Instant.now());
        userRepositoryPort.save(user);

        log.info("User {} verified their email", user.getEmail());
    }

    @Override
    @Transactional
    public void requestReset(String email) {
        // No exception/branch on "no such user": this endpoint must return the exact same
        // outcome either way, or it becomes an oracle for enumerating registered emails.
        userRepositoryPort.findByEmail(normalizeEmail(email)).ifPresent(user -> {
            userTokenRepositoryPort.invalidateAllForUser(user.getId(), UserTokenType.PASSWORD_RESET);

            String rawToken = tokenHashingPort.generateRawToken();
            Instant now = Instant.now();
            UserToken token = UserToken.builder()
                    .id(UUID.randomUUID())
                    .userId(user.getId())
                    .tokenHash(tokenHashingPort.hash(rawToken))
                    .type(UserTokenType.PASSWORD_RESET)
                    .expiresAt(now.plus(PASSWORD_RESET_TTL))
                    .createdAt(now)
                    .build();
            userTokenRepositoryPort.save(token);

            outboxEventPublisherPort.publish(user.getId().toString(), "password-reset-requested", passwordResetTopic,
                    new PasswordResetRequestedEvent(UUID.randomUUID(), user.getEmail(), user.getFullName(), rawToken));

            log.info("Password reset requested for user {}", user.getEmail());
        });
    }

    @Override
    @Transactional
    public void reset(String rawToken, String newPassword) {
        UserToken token = userTokenRepositoryPort
                .findByTokenHashAndType(tokenHashingPort.hash(rawToken), UserTokenType.PASSWORD_RESET)
                .filter(t -> t.isUsable(Instant.now()))
                .orElseThrow(() -> new InvalidTokenException("Password reset link is invalid or expired"));

        User user = userRepositoryPort.findById(token.getUserId())
                .orElseThrow(() -> new InvalidTokenException("Password reset link is invalid or expired"));

        token.setUsedAt(Instant.now());
        userTokenRepositoryPort.save(token);

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        // Proving control of the account's email this way is exactly the signal an admin unlock
        // would otherwise require, so this also clears a LOCKED status and the attempt counter.
        user.setFailedLoginAttempts(0);
        user.setStatus(UserStatus.ACTIVE);
        user.setUpdatedAt(Instant.now());
        userRepositoryPort.save(user);

        refreshTokenRepositoryPort.revokeAllForUser(user.getId());

        log.info("Password reset completed for user {}", user.getEmail());
    }

    private void issueEmailVerificationToken(User user) {
        userTokenRepositoryPort.invalidateAllForUser(user.getId(), UserTokenType.EMAIL_VERIFICATION);

        String rawToken = tokenHashingPort.generateRawToken();
        Instant now = Instant.now();
        UserToken token = UserToken.builder()
                .id(UUID.randomUUID())
                .userId(user.getId())
                .tokenHash(tokenHashingPort.hash(rawToken))
                .type(UserTokenType.EMAIL_VERIFICATION)
                .expiresAt(now.plus(EMAIL_VERIFICATION_TTL))
                .createdAt(now)
                .build();
        userTokenRepositoryPort.save(token);

        outboxEventPublisherPort.publish(user.getId().toString(), "email-verification-requested", emailVerificationTopic,
                new EmailVerificationRequestedEvent(UUID.randomUUID(), user.getEmail(), user.getFullName(), rawToken));
    }

    private AuthTokens issueAuthTokens(User user) {
        IssuedAccessToken accessToken = accessTokenIssuerPort.issue(user);

        String rawRefreshToken = tokenHashingPort.generateRawToken();
        Instant now = Instant.now();
        RefreshToken refreshToken = RefreshToken.builder()
                .id(UUID.randomUUID())
                .userId(user.getId())
                .tokenHash(tokenHashingPort.hash(rawRefreshToken))
                .expiresAt(now.plusSeconds(refreshTokenTtlSeconds))
                .createdAt(now)
                .build();
        refreshTokenRepositoryPort.save(refreshToken);

        return new AuthTokens(accessToken.token(), "Bearer", accessToken.expiresInSeconds(),
                rawRefreshToken, refreshTokenTtlSeconds);
    }

    private static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
