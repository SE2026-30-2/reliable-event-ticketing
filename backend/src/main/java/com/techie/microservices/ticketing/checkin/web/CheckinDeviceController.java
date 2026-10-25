package com.techie.microservices.ticketing.checkin.web;

import com.techie.microservices.ticketing.checkin.application.port.DeviceRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.ListDevicesUseCase;
import com.techie.microservices.ticketing.checkin.application.port.RegisterDeviceCommand;
import com.techie.microservices.ticketing.checkin.application.port.RegisterDeviceUseCase;
import com.techie.microservices.ticketing.checkin.application.port.RevokeDeviceCommand;
import com.techie.microservices.ticketing.checkin.application.port.RevokeDeviceUseCase;
import com.techie.microservices.ticketing.checkin.domain.exception.DeviceNotFoundException;
import com.techie.microservices.ticketing.checkin.web.dto.DeviceResponse;
import com.techie.microservices.ticketing.checkin.web.dto.RegisterDeviceRequest;
import com.techie.microservices.ticketing.checkin.web.dto.RegisterDeviceResponse;
import com.techie.microservices.ticketing.shared.web.AuthenticatedUser;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import com.techie.microservices.ticketing.shared.web.error.ManagementForbiddenException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * ADMIN or ORGANIZER (see SecurityConfig). Device credential lifecycle (issue once, revoke
 * permanently) is a back-office action, never something a device grants itself. An organizer may
 * only register devices bound to an event they manage, and only see/revoke those; a device with no
 * event (usable anywhere) is platform-level and ADMIN-only.
 */
@RestController
@RequestMapping("/api/checkin/devices")
@RequiredArgsConstructor
public class CheckinDeviceController {

    private final RegisterDeviceUseCase registerDeviceUseCase;
    private final RevokeDeviceUseCase revokeDeviceUseCase;
    private final ListDevicesUseCase listDevicesUseCase;
    private final DeviceRepositoryPort deviceRepositoryPort;
    private final ManagementAccess access;

    @PostMapping
    public ResponseEntity<RegisterDeviceResponse> registerDevice(@Valid @RequestBody RegisterDeviceRequest request,
                                                                 @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        if (request.eventId() == null) {
            if (!AuthenticatedUser.isAdmin(authentication)) {
                throw new ManagementForbiddenException("A device must be bound to an event you manage");
            }
        } else {
            access.assertCanManage(request.eventId(), jwt, authentication);
        }
        var registered = registerDeviceUseCase.registerDevice(
                new RegisterDeviceCommand(request.label(), request.eventId(), AuthenticatedUser.email(jwt)));
        return ResponseEntity.status(HttpStatus.CREATED).body(RegisterDeviceResponse.from(registered));
    }

    /** {@code eventId} given: that event's devices (must be manageable). Omitted: every device (ADMIN only). */
    @GetMapping
    public List<DeviceResponse> listDevices(@RequestParam(required = false) UUID eventId,
                                            @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        if (eventId == null) {
            if (!AuthenticatedUser.isAdmin(authentication)) {
                throw new ManagementForbiddenException("Listing every device is restricted to platform admins");
            }
            return listDevicesUseCase.listAll().stream().map(DeviceResponse::from).toList();
        }
        access.assertCanManage(eventId, jwt, authentication);
        return listDevicesUseCase.listForEvent(eventId).stream().map(DeviceResponse::from).toList();
    }

    @PatchMapping("/{deviceId}/revoke")
    public DeviceResponse revokeDevice(@PathVariable UUID deviceId, @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        var device = deviceRepositoryPort.findByDeviceId(deviceId).orElseThrow(() -> new DeviceNotFoundException(deviceId));
        if (device.getEventId() == null) {
            if (!AuthenticatedUser.isAdmin(authentication)) {
                throw new DeviceNotFoundException(deviceId);
            }
        } else if (!access.canManage(device.getEventId(), jwt, authentication)) {
            throw new DeviceNotFoundException(deviceId); // not yours looks like missing
        }
        return DeviceResponse.from(revokeDeviceUseCase.revokeDevice(new RevokeDeviceCommand(deviceId)));
    }
}
