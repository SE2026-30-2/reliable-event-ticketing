package com.ticketing.identity.application.service;

import com.ticketing.identity.application.port.AccessTokenIssuerPort;
import com.ticketing.identity.application.port.AuthTokens;
import com.ticketing.identity.application.port.IssuedAccessToken;
import com.ticketing.identity.application.port.LoginCommand;
import com.ticketing.identity.application.port.OutboxEventPublisherPort;
import com.ticketing.identity.application.port.RefreshTokenRepositoryPort;
import com.ticketing.identity.application.port.RegisterUserCommand;
import com.ticketing.identity.application.port.TokenHashingPort;
import com.ticketing.identity.application.port.UserRepositoryPort;
import com.ticketing.identity.application.port.UserTokenRepositoryPort;
import com.ticketing.identity.domain.exception.AccountLockedException;
import com.ticketing.identity.domain.exception.EmailAlreadyRegisteredException;
import com.ticketing.identity.domain.exception.InvalidCredentialsException;
import com.ticketing.identity.domain.model.RefreshToken;
import com.ticketing.identity.domain.model.User;
import com.ticketing.identity.domain.model.UserStatus;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifies UserApplicationService's account-lifecycle logic against mocked output ports - never a
 * real database/JWT/Kafka. Mirrors payment.application.service.PaymentApplicationServiceTest's
 * style (pure Mockito, no Spring context).
 */
@ExtendWith(MockitoExtension.class)
class UserApplicationServiceTest {

    private static final String EMAIL = "shopper@example.com";
    private static final String RAW_PASSWORD = "correct-password";
    private static final String PASSWORD_HASH = "hashed-password";

    @Mock
    private UserRepositoryPort userRepositoryPort;
    @Mock
    private RefreshTokenRepositoryPort refreshTokenRepositoryPort;
    @Mock
    private UserTokenRepositoryPort userTokenRepositoryPort;
    @Mock
    private OutboxEventPublisherPort outboxEventPublisherPort;
    @Mock
    private AccessTokenIssuerPort accessTokenIssuerPort;
    @Mock
    private TokenHashingPort tokenHashingPort;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AccountLockoutRecorder accountLockoutRecorder;

    private UserApplicationService service;

    @BeforeEach
    void setUp() {
        service = new UserApplicationService(userRepositoryPort, refreshTokenRepositoryPort,
                userTokenRepositoryPort, outboxEventPublisherPort, accessTokenIssuerPort,
                tokenHashingPort, passwordEncoder, accountLockoutRecorder);
        ReflectionTestUtils.setField(service, "refreshTokenTtlSeconds", 604_800L);
        ReflectionTestUtils.setField(service, "emailVerificationTopic", "email-verification-requested");
        ReflectionTestUtils.setField(service, "passwordResetTopic", "password-reset-requested");

        // lenient(): shared defaults convenient for most tests below, but not every test's code
        // path reaches all three (e.g. a request rejected before any save/token-issuance) -
        // Mockito's strict stubbing would otherwise fail those tests over an unused stub.
        lenient().when(userRepositoryPort.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(tokenHashingPort.generateRawToken()).thenReturn("raw-token");
        lenient().when(tokenHashingPort.hash(anyString())).thenReturn("hashed-token");
    }

    private User activeUser() {
        return User.builder()
                .id(UUID.randomUUID())
                .email(EMAIL)
                .passwordHash(PASSWORD_HASH)
                .fullName("Jane Shopper")
                .roles(Set.of("USER"))
                .status(UserStatus.ACTIVE)
                .failedLoginAttempts(0)
                .emailVerified(false)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void register_createsUserWithDefaultRoleAndPublishesVerificationEvent() {
        when(userRepositoryPort.existsByEmail(EMAIL)).thenReturn(false);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn(PASSWORD_HASH);

        User created = service.register(new RegisterUserCommand(EMAIL, RAW_PASSWORD, "Jane Shopper"));

        assertThat(created.getEmail()).isEqualTo(EMAIL);
        assertThat(created.getPasswordHash()).isEqualTo(PASSWORD_HASH);
        assertThat(created.getRoles()).containsExactly("USER");
        assertThat(created.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(created.isEmailVerified()).isFalse();

        verify(outboxEventPublisherPort).publish(eq(created.getId().toString()),
                eq("email-verification-requested"), eq("email-verification-requested"), any());
    }

    @Test
    void register_duplicateEmail_throws() {
        when(userRepositoryPort.existsByEmail(EMAIL)).thenReturn(true);

        assertThatThrownBy(() -> service.register(new RegisterUserCommand(EMAIL, RAW_PASSWORD, "Jane Shopper")))
                .isInstanceOf(EmailAlreadyRegisteredException.class);

        verify(userRepositoryPort, never()).save(any());
    }

    @Test
    void login_success_returnsTokensAndResetsFailedAttempts() {
        User user = activeUser();
        user.setFailedLoginAttempts(2);
        when(userRepositoryPort.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(RAW_PASSWORD, PASSWORD_HASH)).thenReturn(true);
        when(accessTokenIssuerPort.issue(user)).thenReturn(new IssuedAccessToken("access-token", 900L));

        AuthTokens tokens = service.login(new LoginCommand(EMAIL, RAW_PASSWORD));

        assertThat(tokens.accessToken()).isEqualTo("access-token");
        assertThat(tokens.tokenType()).isEqualTo("Bearer");
        assertThat(tokens.expiresIn()).isEqualTo(900L);
        assertThat(tokens.refreshToken()).isEqualTo("raw-token");
        assertThat(tokens.refreshExpiresIn()).isEqualTo(604_800L);
        assertThat(user.getFailedLoginAttempts()).isZero();

        verify(refreshTokenRepositoryPort).save(any(RefreshToken.class));
    }

    @Test
    void login_wrongPassword_delegatesToLockoutRecorderInItsOwnTransaction_andThrows() {
        User user = activeUser();
        when(userRepositoryPort.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), eq(PASSWORD_HASH))).thenReturn(false);

        assertThatThrownBy(() -> service.login(new LoginCommand(EMAIL, "wrong-password")))
                .isInstanceOf(InvalidCredentialsException.class);

        // The increment/lock-threshold logic itself lives in AccountLockoutRecorder (see its own
        // test) - login() only needs to delegate to it. It must go through that separate bean
        // (not a mutation on `user` done inline here) specifically so the increment is committed
        // in its own REQUIRES_NEW transaction and survives this method's transaction rolling back
        // right after, along with the exception above - see AccountLockoutRecorder's Javadoc.
        verify(accountLockoutRecorder).recordFailedAttempt(user.getId());
    }

    @Test
    void login_lockedAccount_rejectsRegardlessOfPassword() {
        User user = activeUser();
        user.setStatus(UserStatus.LOCKED);
        when(userRepositoryPort.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new LoginCommand(EMAIL, RAW_PASSWORD)))
                .isInstanceOf(AccountLockedException.class);

        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(accountLockoutRecorder, never()).recordFailedAttempt(any());
    }

    @Test
    void resetPassword_updatesPasswordUnlocksAccountAndRevokesSessions() {
        User user = activeUser();
        user.setStatus(UserStatus.LOCKED);
        user.setFailedLoginAttempts(3);

        var token = com.ticketing.identity.domain.model.UserToken.builder()
                .id(UUID.randomUUID())
                .userId(user.getId())
                .tokenHash("hashed-token")
                .type(com.ticketing.identity.domain.model.UserTokenType.PASSWORD_RESET)
                .expiresAt(Instant.now().plusSeconds(3600))
                .createdAt(Instant.now())
                .build();

        when(userTokenRepositoryPort.findByTokenHashAndType("hashed-token",
                com.ticketing.identity.domain.model.UserTokenType.PASSWORD_RESET))
                .thenReturn(Optional.of(token));
        when(userRepositoryPort.findById(user.getId())).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");
        when(userTokenRepositoryPort.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.reset("raw-token", "new-password");

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getFailedLoginAttempts()).isZero();
        verify(refreshTokenRepositoryPort).revokeAllForUser(user.getId());
        verify(userTokenRepositoryPort, times(1)).save(any());
    }
}
