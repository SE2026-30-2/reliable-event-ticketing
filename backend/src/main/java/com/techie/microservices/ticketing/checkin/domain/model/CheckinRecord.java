package com.techie.microservices.ticketing.checkin.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * One row per check-in attempt, successful or not - this table IS the audit log (append-only, no
 * update/delete code path anywhere) rather than a separate table kept in sync with one. See
 * {@code CheckinOutcome} for what each outcome means and {@code SubmitCheckinApplicationService}
 * for the exact decision order.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckinRecord {
    private Long id;
    /** Null only when the QR payload couldn't even be decoded into claims (garbage input). */
    private UUID ticketId;
    /** Denormalized from the verified QR claims (not a join to catalog's tables) purely so the
     * dashboard can query "check-ins for event X" directly off this table - same null-only-if-
     * undecodable caveat as ticketId. */
    private UUID eventId;
    /** Null only when the submitted API key didn't resolve to any device at all. */
    private UUID deviceId;
    /** Client-generated, unique - dedupes a retried submission of the exact same scan attempt
     * (distinct from {@link CheckinOutcome#DUPLICATE}, which is a genuine second use of a ticket
     * already accepted under a *different* attempt). */
    private UUID idempotencyKey;
    /** What the device's own clock claimed - recorded for the dashboard timeline/forensics only,
     * never used to decide ACCEPTED vs DUPLICATE (an untrusted client clock cannot be the
     * arbiter of a security-relevant conflict - server commit order is, see the DB partial
     * unique index this relies on). */
    private Instant clientCheckinAt;
    private Instant serverReceivedAt;
    private CheckinOutcome outcome;
    private String detail;
    private Instant createdAt;
    /** Which entry this ACCEPTED scan was (1 for a single-use ticket); null for every other outcome. */
    private Integer entryNo;
}
