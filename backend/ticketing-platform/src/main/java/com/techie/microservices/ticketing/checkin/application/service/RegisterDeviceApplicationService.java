package com.techie.microservices.ticketing.checkin.application.service;

import com.techie.microservices.ticketing.checkin.application.port.DeviceRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.RegisterDeviceCommand;
import com.techie.microservices.ticketing.checkin.application.port.RegisterDeviceUseCase;
import com.techie.microservices.ticketing.checkin.application.port.RegisteredDevice;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;
import com.techie.microservices.ticketing.checkin.domain.model.DeviceStatus;
import com.techie.microservices.ticketing.checkin.infrastructure.security.ApiKeyHasher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class RegisterDeviceApplicationService implements RegisterDeviceUseCase {

    private final DeviceRepositoryPort deviceRepositoryPort;
    private final ApiKeyHasher apiKeyHasher;

    @Override
    public RegisteredDevice registerDevice(RegisterDeviceCommand command) {
        String plaintextApiKey = apiKeyHasher.generate();
        CheckinDevice device = CheckinDevice.builder()
                .deviceId(UUID.randomUUID())
                .label(command.label())
                .eventId(command.eventId())
                .status(DeviceStatus.ACTIVE)
                .apiKeyHash(apiKeyHasher.hash(plaintextApiKey))
                .createdAt(Instant.now())
                .createdBy(command.createdBy())
                .build();
        CheckinDevice saved = deviceRepositoryPort.save(device);

        log.info("Registered check-in device {} ({})", saved.getDeviceId(), saved.getLabel());
        return new RegisteredDevice(saved, plaintextApiKey);
    }
}
