package com.techie.microservices.ticketing.checkin.application.port;

import java.time.Instant;
import java.util.UUID;

/**
 * @param deviceApiKey    raw plaintext key from the {@code X-Device-Key} header - never logged,
 *                        hashed once and discarded by {@code SubmitCheckinApplicationService}.
 * @param qrPayload       the exact string the device scanned - the service decodes/verifies it
 *                        itself; {@code ticketId} is never trusted as a separate client-supplied
 *                        field, only what the verified signature's claims say.
 * @param idempotencyKey  client-generated, dedupes a retried submission of this same attempt.
 * @param clientCheckinAt the device's own clock - recorded for the dashboard/forensics only, see
 *                        {@code CheckinRecord}.
 */
public record SubmitCheckinCommand(
        String deviceApiKey,
        String qrPayload,
        UUID idempotencyKey,
        Instant clientCheckinAt
) {
}
