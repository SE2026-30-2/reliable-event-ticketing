package com.ticketing.identity.application.port;

public record IssuedAccessToken(String token, long expiresInSeconds) {
}
