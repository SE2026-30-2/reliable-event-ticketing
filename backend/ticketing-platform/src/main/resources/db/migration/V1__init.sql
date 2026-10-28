-- Core ticketing domain: an event has one or more ticket types (price tiers / categories), each
-- with a fixed quota; a ticket is one issued unit of a ticket type, bound to a holder.
CREATE TABLE events
(
    id         BIGSERIAL PRIMARY KEY,
    event_id   UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    venue      VARCHAR(255),
    starts_at  TIMESTAMPTZ  NOT NULL,
    ends_at    TIMESTAMPTZ  NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, CANCELLED, COMPLETED
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE ticket_types
(
    id             BIGSERIAL PRIMARY KEY,
    ticket_type_id UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_id       UUID         NOT NULL REFERENCES events (event_id),
    name           VARCHAR(100) NOT NULL, -- e.g. "General Admission", "VIP"
    price_cents    BIGINT       NOT NULL DEFAULT 0,
    quota          INTEGER      NOT NULL,
    issued_count   INTEGER      NOT NULL DEFAULT 0,
    -- Tickets currently held RESERVED (quota claimed, payment outcome not yet known) for this
    -- type - counted separately from issued_count so a sold-out check can refuse new reservations
    -- without waiting for a RESERVED ticket to resolve one way or the other first.
    reserved_count INTEGER      NOT NULL DEFAULT 0,
    -- Default check-in validity window for tickets of this type; copied onto each ticket at
    -- reservation time (server clock), then baked immutably into that ticket's signed QR payload
    -- once issued - this is the anchor that later defeats scanning-device clock skew at check-in.
    valid_from     TIMESTAMPTZ  NOT NULL,
    valid_until    TIMESTAMPTZ  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_quota_nonneg CHECK (quota >= 0),
    CONSTRAINT chk_reserved_nonneg CHECK (reserved_count >= 0),
    CONSTRAINT chk_issued_plus_reserved_le_quota CHECK (issued_count + reserved_count <= quota)
);
CREATE INDEX idx_ticket_types_event ON ticket_types (event_id);

CREATE TABLE tickets
(
    id             BIGSERIAL PRIMARY KEY,
    ticket_id      UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    ticket_type_id UUID         NOT NULL REFERENCES ticket_types (ticket_type_id),
    event_id       UUID         NOT NULL REFERENCES events (event_id),
    holder_name    VARCHAR(255),
    holder_email   VARCHAR(255),
    -- RESERVED (quota held, awaiting a payment outcome) is the initial state; ISSUED is the only
    -- check-in-eligible state; CANCELLED/VOID/REFUNDED are terminal - see TicketStatus for the
    -- full transition table.
    status         VARCHAR(20)  NOT NULL DEFAULT 'RESERVED',
    status_reason  TEXT,
    -- Groups every ticket created by one reserve call - what a payment outcome correlates
    -- against (ConfirmReservationApplicationService/CancelReservationApplicationService).
    reservation_id UUID,
    reservation_expires_at TIMESTAMPTZ,
    -- Null until the ticket is ISSUED - a RESERVED ticket has no issuance moment yet.
    issued_at      TIMESTAMPTZ,
    valid_from     TIMESTAMPTZ  NOT NULL,
    valid_until    TIMESTAMPTZ  NOT NULL,
    -- The exact signed string placed in the ticket's QR code ("<kid>.<payload>.<sig>" - see
    -- TicketQrSigner) kept verbatim so it can be re-rendered (buyer confirmation page,
    -- notification module's emailed image) without re-signing. Null until ISSUED - signing
    -- happens at confirm-reservation time, not at reserve time.
    qr_payload     TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_reservation ON tickets (reservation_id);
CREATE INDEX idx_tickets_event ON tickets (event_id);
CREATE INDEX idx_tickets_ticket_type ON tickets (ticket_type_id);
