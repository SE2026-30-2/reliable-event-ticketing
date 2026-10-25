package com.techie.microservices.ticketing.checkin.application.port;

import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;

public interface RevokeDeviceUseCase {
    CheckinDevice revokeDevice(RevokeDeviceCommand command);
}
