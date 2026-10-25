package com.techie.microservices.ticketing.checkin.application.port;

import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;

/** Carries the plaintext API key - the only point in this system's lifetime that value exists
 * outside the device itself; {@link CheckinDevice#getApiKeyHash()} is all that's ever persisted. */
public record RegisteredDevice(CheckinDevice device, String plaintextApiKey) {
}
