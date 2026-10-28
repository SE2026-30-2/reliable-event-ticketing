package com.ticketing.platform.checkin.domain.exception;

import java.util.UUID;

public class DeviceNotFoundException extends RuntimeException {
    public DeviceNotFoundException(UUID deviceId) {
        super("Check-in device " + deviceId + " not found");
    }
}
