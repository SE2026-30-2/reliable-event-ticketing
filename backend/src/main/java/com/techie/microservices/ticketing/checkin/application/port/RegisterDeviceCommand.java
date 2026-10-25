package com.techie.microservices.ticketing.checkin.application.port;

import java.util.UUID;

public record RegisterDeviceCommand(String label, UUID eventId, String createdBy) {
    public RegisterDeviceCommand(String label, UUID eventId) {
        this(label, eventId, null);
    }
}
