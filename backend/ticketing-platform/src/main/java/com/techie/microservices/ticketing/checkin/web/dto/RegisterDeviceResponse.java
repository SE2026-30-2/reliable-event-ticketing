package com.techie.microservices.ticketing.checkin.web.dto;

import com.techie.microservices.ticketing.checkin.application.port.RegisteredDevice;

import java.util.UUID;

public record RegisterDeviceResponse(UUID deviceId, String label, UUID eventId, String apiKey) {
    /** {@code apiKey} is the plaintext value - this response is the only time it is ever visible,
     * see {@link RegisteredDevice}. */
    public static RegisterDeviceResponse from(RegisteredDevice registered) {
        return new RegisterDeviceResponse(
                registered.device().getDeviceId(),
                registered.device().getLabel(),
                registered.device().getEventId(),
                registered.plaintextApiKey());
    }
}
