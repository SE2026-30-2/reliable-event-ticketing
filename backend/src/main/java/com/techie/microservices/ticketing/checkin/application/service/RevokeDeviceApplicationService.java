package com.techie.microservices.ticketing.checkin.application.service;

import com.techie.microservices.ticketing.checkin.application.port.DeviceRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.RevokeDeviceCommand;
import com.techie.microservices.ticketing.checkin.application.port.RevokeDeviceUseCase;
import com.techie.microservices.ticketing.checkin.domain.exception.DeviceNotFoundException;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;
import com.techie.microservices.ticketing.checkin.domain.model.DeviceStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Revoking a device is immediate and permanent in this system - there is no "reactivate," a lost
 * or compromised scanner gets a brand new device+key registered instead. Every subsequent
 * submission from the old key (including anything already queued offline on that device) is
 * rejected as {@code DEVICE_REVOKED} and logged, not silently dropped.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class RevokeDeviceApplicationService implements RevokeDeviceUseCase {

    private final DeviceRepositoryPort deviceRepositoryPort;

    @Override
    public CheckinDevice revokeDevice(RevokeDeviceCommand command) {
        CheckinDevice device = deviceRepositoryPort.findByDeviceId(command.deviceId())
                .orElseThrow(() -> new DeviceNotFoundException(command.deviceId()));
        device.setStatus(DeviceStatus.REVOKED);
        device.setRevokedAt(Instant.now());
        CheckinDevice saved = deviceRepositoryPort.save(device);
        log.info("Revoked check-in device {}", saved.getDeviceId());
        return saved;
    }
}
