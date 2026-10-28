package com.ticketing.identity.web;

import com.ticketing.identity.application.port.AuthTokens;
import com.ticketing.identity.application.port.ForgotPasswordUseCase;
import com.ticketing.identity.application.port.GetUserByEmailUseCase;
import com.ticketing.identity.application.port.LoginCommand;
import com.ticketing.identity.application.port.LoginUseCase;
import com.ticketing.identity.application.port.LogoutUseCase;
import com.ticketing.identity.application.port.RefreshAccessTokenUseCase;
import com.ticketing.identity.application.port.RegisterUserCommand;
import com.ticketing.identity.application.port.RegisterUserUseCase;
import com.ticketing.identity.application.port.RequestEmailVerificationUseCase;
import com.ticketing.identity.application.port.ResetPasswordUseCase;
import com.ticketing.identity.application.port.VerifyEmailUseCase;
import com.ticketing.identity.domain.model.User;
import com.ticketing.identity.web.dto.ForgotPasswordRequest;
import com.ticketing.identity.web.dto.LoginRequest;
import com.ticketing.identity.web.dto.LoginResponse;
import com.ticketing.identity.web.dto.RefreshRequest;
import com.ticketing.identity.web.dto.RegisterRequest;
import com.ticketing.identity.web.dto.ResetPasswordRequest;
import com.ticketing.identity.web.dto.UserResponse;
import com.ticketing.identity.web.dto.VerifyEmailRequest;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/**
 * Thin controller - calls only application-layer input ports, never a repository/entity directly.
 * Error mapping is handled centrally by {@link com.ticketing.identity.web.error.GlobalExceptionHandler}.
 * Public endpoints (register/login/refresh/email-verify/password-forgot/password-reset) and the
 * two authenticated ones (me, resend-verification, logout) are enumerated in
 * {@code config.SecurityConfig}.
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final RegisterUserUseCase registerUserUseCase;
    private final LoginUseCase loginUseCase;
    private final RefreshAccessTokenUseCase refreshAccessTokenUseCase;
    private final LogoutUseCase logoutUseCase;
    private final GetUserByEmailUseCase getUserByEmailUseCase;
    private final RequestEmailVerificationUseCase requestEmailVerificationUseCase;
    private final VerifyEmailUseCase verifyEmailUseCase;
    private final ForgotPasswordUseCase forgotPasswordUseCase;
    private final ResetPasswordUseCase resetPasswordUseCase;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest request) {
        User user = registerUserUseCase.register(
                new RegisterUserCommand(request.email(), request.password(), request.fullName()));
        return UserResponse.from(user);
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        AuthTokens tokens = loginUseCase.login(new LoginCommand(request.email(), request.password()));
        return LoginResponse.from(tokens);
    }

    @PostMapping("/refresh")
    public LoginResponse refresh(@Valid @RequestBody RefreshRequest request) {
        AuthTokens tokens = refreshAccessTokenUseCase.refresh(request.refreshToken());
        return LoginResponse.from(tokens);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest request) {
        logoutUseCase.logout(request.refreshToken());
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return UserResponse.from(getUserByEmailUseCase.getByEmail(jwt.getSubject()));
    }

    @PostMapping("/email/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        verifyEmailUseCase.verify(request.token());
    }

    @PostMapping("/email/verify/resend")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification(@AuthenticationPrincipal Jwt jwt) {
        requestEmailVerificationUseCase.requestVerification(jwt.getSubject());
    }

    @PostMapping("/password/forgot")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        forgotPasswordUseCase.requestReset(request.email());
    }

    @PostMapping("/password/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        resetPasswordUseCase.reset(request.token(), request.newPassword());
    }
}
