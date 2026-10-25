package com.techie.microservices.ticketing.checkin.application.port;

import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;

import java.util.List;
import java.util.UUID;

public interface ListDevicesUseCase {
    /** Devices registered for one event (never exposes key material - only the hash exists anyway). */
    List<CheckinDevice> listForEvent(UUID eventId);

    /** Every device, including those not tied to an event - ADMIN only. */
    List<CheckinDevice> listAll();
}
