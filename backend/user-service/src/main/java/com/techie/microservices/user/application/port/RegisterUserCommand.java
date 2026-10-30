package com.techie.microservices.user.application.port;

public record RegisterUserCommand(String email, String rawPassword, String fullName) {
}
