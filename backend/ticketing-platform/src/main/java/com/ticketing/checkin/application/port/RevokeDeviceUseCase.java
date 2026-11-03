package com.ticketing.checkin.application.port;

import com.ticketing.checkin.domain.model.CheckinDevice;

public interface RevokeDeviceUseCase {
    CheckinDevice revokeDevice(RevokeDeviceCommand command);
}
