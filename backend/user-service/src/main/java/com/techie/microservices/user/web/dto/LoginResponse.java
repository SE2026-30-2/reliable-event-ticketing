package com.techie.microservices.user.web.dto;

import com.techie.microservices.user.application.port.AuthTokens;

/** Response body for POST /api/user/login and POST /api/user/refresh. */
public record LoginResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        String refreshToken,
        long refreshExpiresIn
) {
    public static LoginResponse from(AuthTokens tokens) {
        return new LoginResponse(
                tokens.accessToken(),
                tokens.tokenType(),
                tokens.expiresIn(),
                tokens.refreshToken(),
                tokens.refreshExpiresIn()
        );
    }
}
