package com.techie.microservices.user.application.port;

public record IssuedAccessToken(String token, long expiresInSeconds) {
}
