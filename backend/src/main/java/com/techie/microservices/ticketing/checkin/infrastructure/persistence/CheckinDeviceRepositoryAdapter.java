package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

import com.techie.microservices.ticketing.checkin.application.port.DeviceRepositoryPort;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;
import com.techie.microservices.ticketing.checkin.domain.model.DeviceStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CheckinDeviceRepositoryAdapter implements DeviceRepositoryPort {

    private final SpringDataCheckinDeviceJpaRepository jpaRepository;

    @Override
    public CheckinDevice save(CheckinDevice device) {
        return toDomain(jpaRepository.save(toEntity(device)));
    }

    @Override
    public Optional<CheckinDevice> findByDeviceId(UUID deviceId) {
        return jpaRepository.findByDeviceId(deviceId).map(CheckinDeviceRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<CheckinDevice> findByApiKeyHash(String apiKeyHash) {
        return jpaRepository.findByApiKeyHash(apiKeyHash).map(CheckinDeviceRepositoryAdapter::toDomain);
    }

    @Override
    public List<CheckinDevice> findAll() {
        return jpaRepository.findAll().stream().map(CheckinDeviceRepositoryAdapter::toDomain).toList();
    }

    @Override
    public List<CheckinDevice> findByEventId(UUID eventId) {
        return jpaRepository.findByEventIdOrderByCreatedAtDesc(eventId).stream().map(CheckinDeviceRepositoryAdapter::toDomain).toList();
    }

    private static CheckinDeviceEntity toEntity(CheckinDevice device) {
        return CheckinDeviceEntity.builder()
                .id(device.getId())
                .deviceId(device.getDeviceId())
                .label(device.getLabel())
                .eventId(device.getEventId())
                .status(device.getStatus().name())
                .apiKeyHash(device.getApiKeyHash())
                .createdAt(device.getCreatedAt())
                .revokedAt(device.getRevokedAt())
                .lastSeenAt(device.getLastSeenAt())
                .createdBy(device.getCreatedBy())
                .build();
    }

    private static CheckinDevice toDomain(CheckinDeviceEntity entity) {
        return CheckinDevice.builder()
                .id(entity.getId())
                .deviceId(entity.getDeviceId())
                .label(entity.getLabel())
                .eventId(entity.getEventId())
                .status(DeviceStatus.valueOf(entity.getStatus()))
                .apiKeyHash(entity.getApiKeyHash())
                .createdAt(entity.getCreatedAt())
                .revokedAt(entity.getRevokedAt())
                .lastSeenAt(entity.getLastSeenAt())
                .createdBy(entity.getCreatedBy())
                .build();
    }
}
