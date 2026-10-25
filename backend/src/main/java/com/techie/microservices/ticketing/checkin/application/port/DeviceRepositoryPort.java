package com.techie.microservices.ticketing.checkin.application.port;

import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceRepositoryPort {
    CheckinDevice save(CheckinDevice device);

    Optional<CheckinDevice> findByDeviceId(UUID deviceId);

    Optional<CheckinDevice> findByApiKeyHash(String apiKeyHash);

    List<CheckinDevice> findAll();

    List<CheckinDevice> findByEventId(UUID eventId);
}
