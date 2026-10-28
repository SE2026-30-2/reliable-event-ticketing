package com.ticketing.identity.application.port;

public record LoginCommand(String email, String rawPassword) {
}
