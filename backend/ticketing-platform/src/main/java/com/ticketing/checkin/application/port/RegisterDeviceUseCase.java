package com.ticketing.checkin.application.port;

public interface RegisterDeviceUseCase {
    RegisteredDevice registerDevice(RegisterDeviceCommand command);
}
