package com.techie.microservices.ticketing.checkin.web.dto;

import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;

import java.time.Instant;
import java.util.UUID;

public record DeviceResponse(
        UUID deviceId, String label, UUID eventId, String status,
        Instant createdAt, Instant revokedAt, Instant lastSeenAt
) {
    public static DeviceResponse from(CheckinDevice device) {
        return new DeviceResponse(
                device.getDeviceId(), device.getLabel(), device.getEventId(), device.getStatus().name(),
                device.getCreatedAt(), device.getRevokedAt(), device.getLastSeenAt());
    }
}
