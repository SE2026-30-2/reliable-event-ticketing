package com.techie.microservices.ticketing.checkin.application.service;

import com.techie.microservices.ticketing.checkin.application.port.DeviceRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.RegisterDeviceCommand;
import com.techie.microservices.ticketing.checkin.application.port.RegisteredDevice;
import com.techie.microservices.ticketing.checkin.application.port.RevokeDeviceCommand;
import com.techie.microservices.ticketing.checkin.domain.exception.DeviceNotFoundException;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;
import com.techie.microservices.ticketing.checkin.domain.model.DeviceStatus;
import com.techie.microservices.ticketing.checkin.infrastructure.security.ApiKeyHasher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceApplicationServiceTest {

    @Mock
    private DeviceRepositoryPort deviceRepositoryPort;
    @Mock
    private ApiKeyHasher apiKeyHasher;

    @Test
    void registerDeviceHashesTheGeneratedKeyAndReturnsTheRawKeyOnlyOnce() {
        RegisterDeviceApplicationService service = new RegisterDeviceApplicationService(deviceRepositoryPort, apiKeyHasher);
        when(apiKeyHasher.generate()).thenReturn("raw-key");
        when(apiKeyHasher.hash("raw-key")).thenReturn("hashed-key");
        when(deviceRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RegisteredDevice registered = service.registerDevice(new RegisterDeviceCommand("Gate A", null));

        assertThat(registered.plaintextApiKey()).isEqualTo("raw-key");
        assertThat(registered.device().getApiKeyHash()).isEqualTo("hashed-key");
        assertThat(registered.device().getStatus()).isEqualTo(DeviceStatus.ACTIVE);

        ArgumentCaptor<CheckinDevice> captor = ArgumentCaptor.forClass(CheckinDevice.class);
        verify(deviceRepositoryPort).save(captor.capture());
        assertThat(captor.getValue().getApiKeyHash()).isEqualTo("hashed-key");
    }

    @Test
    void revokeDeviceSetsStatusAndTimestamp() {
        RevokeDeviceApplicationService service = new RevokeDeviceApplicationService(deviceRepositoryPort);
        UUID deviceId = UUID.randomUUID();
        CheckinDevice device = CheckinDevice.builder().deviceId(deviceId).status(DeviceStatus.ACTIVE).build();
        when(deviceRepositoryPort.findByDeviceId(deviceId)).thenReturn(Optional.of(device));
        when(deviceRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinDevice result = service.revokeDevice(new RevokeDeviceCommand(deviceId));

        assertThat(result.getStatus()).isEqualTo(DeviceStatus.REVOKED);
        assertThat(result.getRevokedAt()).isNotNull();
    }

    @Test
    void revokeDeviceThrowsWhenDeviceDoesNotExist() {
        RevokeDeviceApplicationService service = new RevokeDeviceApplicationService(deviceRepositoryPort);
        UUID deviceId = UUID.randomUUID();
        when(deviceRepositoryPort.findByDeviceId(deviceId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.revokeDevice(new RevokeDeviceCommand(deviceId)))
                .isInstanceOf(DeviceNotFoundException.class);
    }
}
