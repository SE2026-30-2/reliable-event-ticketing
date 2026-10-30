package com.techie.microservices.user.application.port;

/**
 * Everything POST /api/user/login and POST /api/user/refresh hand back to the client - shaped
 * 1:1 with the frontend's LoginResult type (web/dto/LoginResponse.java mirrors this exactly).
 */
public record AuthTokens(
        String accessToken,
        String tokenType,
        long expiresIn,
        String refreshToken,
        long refreshExpiresIn
) {
}
