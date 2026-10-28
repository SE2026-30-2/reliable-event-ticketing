package com.techie.microservices.ticketing.checkin.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckinDevice {
    private Long id;
    private UUID deviceId;
    private String label;
    /** Null = usable to check in tickets for any event; set = restricted to one event/gate. */
    private UUID eventId;
    private DeviceStatus status;
    /** SHA-256 of the plaintext API key - the plaintext itself is shown exactly once, at
     * registration, and never persisted anywhere. */
    private String apiKeyHash;
    private Instant createdAt;
    private Instant revokedAt;
    private Instant lastSeenAt;
    /** The account that registered it (audit; scopes what an ORGANIZER may revoke). */
    private String createdBy;
}
