package com.techie.microservices.ticketing.checkin.web.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record RegisterDeviceRequest(@NotBlank String label, UUID eventId) {
}
