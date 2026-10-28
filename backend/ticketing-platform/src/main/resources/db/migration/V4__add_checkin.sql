CREATE TABLE checkin_devices
(
    id            BIGSERIAL PRIMARY KEY,
    device_id     UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    label         VARCHAR(255) NOT NULL,
    -- Null = usable to check in tickets for any event; set = restricted to one event/gate.
    event_id      UUID,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REVOKED
    -- SHA-256 of the plaintext API key - plaintext is shown exactly once, at registration, and
    -- never persisted anywhere.
    api_key_hash  VARCHAR(255) NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at    TIMESTAMPTZ,
    last_seen_at  TIMESTAMPTZ
);

-- Append-only by convention (application code never updates or deletes a row here) - this table
-- IS the audit log, not a separate thing kept in sync with one.
CREATE TABLE checkin_records
(
    id                 BIGSERIAL PRIMARY KEY,
    -- Null only when the QR payload couldn't be decoded into claims at all (garbage input).
    ticket_id          UUID,
    -- Denormalized from the verified QR claims so the dashboard can query "check-ins for event X"
    -- directly off this table, no join into catalog's tables needed.
    event_id           UUID,
    -- Null only when the submitted API key didn't resolve to any registered device.
    device_id          UUID,
    -- Client-generated - dedupes a retried submission of this exact attempt (distinct from a
    -- DUPLICATE outcome, which is a second use of an already-ACCEPTED ticket under a different
    -- attempt).
    idempotency_key    UUID        NOT NULL UNIQUE,
    client_checkin_at  TIMESTAMPTZ,
    server_received_at TIMESTAMPTZ NOT NULL,
    outcome            VARCHAR(30) NOT NULL, -- see domain.model.CheckinOutcome
    detail             TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The actual anti-replay mechanism: at most one ACCEPTED row per ticket, ever. First INSERT to
-- commit wins (see CheckinRecordRepositoryAdapter.tryInsertAccepted) - not "earliest
-- client_checkin_at," which is attacker-controllable on a compromised scanner.
CREATE UNIQUE INDEX idx_checkin_records_accepted_ticket ON checkin_records (ticket_id) WHERE outcome = 'ACCEPTED';
CREATE INDEX idx_checkin_records_event_outcome ON checkin_records (event_id, outcome);

-- Local read model of catalog's ticket-voided events (see VoidedTicketCacheListener) - lets
-- check-in submission reject a voided/refunded ticket without a synchronous call into catalog.
CREATE TABLE voided_tickets
(
    ticket_id UUID PRIMARY KEY,
    reason    TEXT,
    voided_at TIMESTAMPTZ NOT NULL
);
