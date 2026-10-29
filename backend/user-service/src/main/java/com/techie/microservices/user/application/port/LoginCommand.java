package com.techie.microservices.user.application.port;

public record LoginCommand(String email, String rawPassword) {
}
