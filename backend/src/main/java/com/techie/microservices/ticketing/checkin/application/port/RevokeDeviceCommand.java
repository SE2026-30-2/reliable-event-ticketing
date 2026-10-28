package com.techie.microservices.ticketing.checkin.application.port;

import java.util.UUID;

public record RevokeDeviceCommand(UUID deviceId) {
}
