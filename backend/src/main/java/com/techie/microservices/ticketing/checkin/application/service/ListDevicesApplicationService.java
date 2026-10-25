package com.techie.microservices.ticketing.checkin.application.service;

import com.techie.microservices.ticketing.checkin.application.port.DeviceRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.ListDevicesUseCase;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ListDevicesApplicationService implements ListDevicesUseCase {

    private final DeviceRepositoryPort deviceRepositoryPort;

    @Override
    public List<CheckinDevice> listForEvent(UUID eventId) {
        return deviceRepositoryPort.findByEventId(eventId);
    }

    @Override
    public List<CheckinDevice> listAll() {
        return deviceRepositoryPort.findAll();
    }
}
