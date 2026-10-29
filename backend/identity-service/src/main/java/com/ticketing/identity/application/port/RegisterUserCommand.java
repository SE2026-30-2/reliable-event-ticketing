package com.ticketing.identity.application.port;

public record RegisterUserCommand(String email, String rawPassword, String fullName) {
}
