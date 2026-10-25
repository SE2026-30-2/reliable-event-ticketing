package com.techie.microservices.ticketing.checkin.application.service;

import com.techie.microservices.ticketing.checkin.application.port.AcceptResult;
import com.techie.microservices.ticketing.checkin.application.port.CheckinRecordRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.DeviceRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.SubmitCheckinCommand;
import com.techie.microservices.ticketing.checkin.application.port.SubmitCheckinUseCase;
import com.techie.microservices.ticketing.checkin.application.port.VoidedTicketCachePort;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinOutcome;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinRecord;
import com.techie.microservices.ticketing.checkin.domain.model.DeviceStatus;
import com.techie.microservices.ticketing.checkin.infrastructure.security.ApiKeyHasher;
import com.techie.microservices.ticketing.checkin.infrastructure.security.TicketQrVerifier;
import com.techie.microservices.ticketing.checkin.infrastructure.security.VerifiedTicketClaims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * No class-level {@code @Transactional} here, deliberately: {@link #submitCheckinBatch} calls
 * {@link #submitCheckin} in a plain loop (same-class self-invocation, which bypasses Spring's
 * proxy-based transaction advice anyway), and each step below is already correctly scoped on its
 * own - a plain read, a device-lastSeen update, or {@link CheckinRecordRepositoryPort#tryAccept}
 * (its own {@code REQUIRES_NEW} transaction). This is what actually gives the batch path "each
 * item independently committed, one bad item can't affect another," rather than a class-level
 * annotation that self-invocation would have silently ignored.
 * <p>
 * Decision order for a single submission: resolve device -> verify QR signature -> check validity
 * window -> check the voided-ticket cache -> attempt the accepted insert. Device identity is
 * resolved and audited *before* QR validity so a submission from an unknown/revoked device is
 * rejected and logged as such even when the QR itself would otherwise have been genuine - the
 * device's own trust boundary is independent of (and checked ahead of) the ticket's.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SubmitCheckinApplicationService implements SubmitCheckinUseCase {

    private final CheckinRecordRepositoryPort checkinRecordRepositoryPort;
    private final DeviceRepositoryPort deviceRepositoryPort;
    private final VoidedTicketCachePort voidedTicketCachePort;
    private final TicketQrVerifier ticketQrVerifier;
    private final ApiKeyHasher apiKeyHasher;

    @Override
    public CheckinRecord submitCheckin(SubmitCheckinCommand command) {
        Optional<CheckinRecord> replay = checkinRecordRepositoryPort.findByIdempotencyKey(command.idempotencyKey());
        if (replay.isPresent()) {
            return replay.get();
        }

        Instant serverReceivedAt = Instant.now();
        CheckinDevice device = resolveDevice(command.deviceApiKey());
        Optional<VerifiedTicketClaims> claims = ticketQrVerifier.verify(command.qrPayload());

        UUID ticketId = claims.map(VerifiedTicketClaims::ticketId).orElse(null);
        UUID eventId = claims.map(VerifiedTicketClaims::eventId).orElse(null);
        UUID deviceId = device != null ? device.getDeviceId() : null;

        if (device == null) {
            return persist(ticketId, eventId, deviceId, command, serverReceivedAt,
                    CheckinOutcome.DEVICE_NOT_FOUND, "No registered device matches the submitted key");
        }
        if (device.getStatus() == DeviceStatus.REVOKED) {
            return persist(ticketId, eventId, deviceId, command, serverReceivedAt,
                    CheckinOutcome.DEVICE_REVOKED, "Device was revoked at " + device.getRevokedAt());
        }
        if (claims.isEmpty()) {
            return persist(ticketId, eventId, deviceId, command, serverReceivedAt,
                    CheckinOutcome.INVALID_SIGNATURE, "QR payload failed signature verification or could not be decoded");
        }
        if (device.getEventId() != null && !device.getEventId().equals(eventId)) {
            return persist(ticketId, eventId, deviceId, command, serverReceivedAt,
                    CheckinOutcome.WRONG_EVENT, "Device is registered for event " + device.getEventId());
        }
        long now = serverReceivedAt.getEpochSecond();
        if (now < claims.get().validFromEpochSeconds() || now > claims.get().validUntilEpochSeconds()) {
            return persist(ticketId, eventId, deviceId, command, serverReceivedAt,
                    CheckinOutcome.EXPIRED_WINDOW, "Outside the ticket's valid window");
        }
        if (voidedTicketCachePort.isVoided(ticketId)) {
            return persist(ticketId, eventId, deviceId, command, serverReceivedAt,
                    CheckinOutcome.TICKET_VOIDED, "Ticket was voided/refunded after issuance");
        }

        int maxEntries = claims.get().maxEntries();
        CheckinRecord acceptedAttempt = buildRecord(ticketId, eventId, deviceId, command, serverReceivedAt,
                CheckinOutcome.ACCEPTED, maxEntries > 1 ? "Accepted scan (up to " + maxEntries + " entries)" : "First accepted scan");
        AcceptResult result = checkinRecordRepositoryPort.tryAccept(acceptedAttempt, maxEntries);
        return switch (result) {
            case ACCEPTED -> acceptedAttempt;
            // Voided between the cache check above and the atomic insert (a transfer or void landed meanwhile).
            case VOIDED -> persist(ticketId, eventId, deviceId, command, serverReceivedAt,
                    CheckinOutcome.TICKET_VOIDED, "Ticket was voided/refunded/transferred after issuance");
            case ALL_ENTRIES_USED -> persist(ticketId, eventId, deviceId, command, serverReceivedAt,
                    CheckinOutcome.DUPLICATE, maxEntries > 1 ? "All " + maxEntries + " entries already used" : "Ticket already checked in");
        };
    }

    @Override
    public List<CheckinRecord> submitCheckinBatch(List<SubmitCheckinCommand> commands) {
        List<CheckinRecord> results = new ArrayList<>(commands.size());
        for (SubmitCheckinCommand command : commands) {
            results.add(submitCheckin(command));
        }
        return results;
    }

    private CheckinDevice resolveDevice(String deviceApiKey) {
        if (deviceApiKey == null || deviceApiKey.isBlank()) {
            return null;
        }
        Optional<CheckinDevice> device = deviceRepositoryPort.findByApiKeyHash(apiKeyHasher.hash(deviceApiKey));
        device.ifPresent(d -> {
            d.setLastSeenAt(Instant.now());
            deviceRepositoryPort.save(d);
        });
        return device.orElse(null);
    }

    private CheckinRecord persist(UUID ticketId, UUID eventId, UUID deviceId, SubmitCheckinCommand command,
                                   Instant serverReceivedAt, CheckinOutcome outcome, String detail) {
        CheckinRecord record = buildRecord(ticketId, eventId, deviceId, command, serverReceivedAt, outcome, detail);
        CheckinRecord saved = checkinRecordRepositoryPort.save(record);
        log.info("Check-in {} for ticket {} (device {}): {}", outcome, ticketId, deviceId, detail);
        return saved;
    }

    private CheckinRecord buildRecord(UUID ticketId, UUID eventId, UUID deviceId, SubmitCheckinCommand command,
                                       Instant serverReceivedAt, CheckinOutcome outcome, String detail) {
        return CheckinRecord.builder()
                .ticketId(ticketId)
                .eventId(eventId)
                .deviceId(deviceId)
                .idempotencyKey(command.idempotencyKey())
                .clientCheckinAt(command.clientCheckinAt())
                .serverReceivedAt(serverReceivedAt)
                .outcome(outcome)
                .detail(detail)
                .createdAt(serverReceivedAt)
                .build();
    }
}
