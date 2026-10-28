-- First-come-first-served waiting list for sold-out ticket types. When quota frees up the oldest entry
-- that fits is given a normal reservation (a time-limited hold, tickets in RESERVED) and emailed a link to
-- pay; if it lapses, quota is released and the next entry is offered.
CREATE TABLE waitlist_entries
(
    id             BIGSERIAL PRIMARY KEY,
    entry_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    ticket_type_id UUID         NOT NULL REFERENCES ticket_types (ticket_type_id),
    owner_email    VARCHAR(255) NOT NULL,            -- the buyer account (JWT subject, lower-cased)
    holder_name    VARCHAR(255) NOT NULL,
    holder_email   VARCHAR(255) NOT NULL,
    quantity       INTEGER      NOT NULL,            -- units, as in a reservation
    status         VARCHAR(20)  NOT NULL DEFAULT 'WAITING', -- WAITING | OFFERED | CONVERTED | EXPIRED | CANCELLED
    reservation_id UUID,
    failure_reason VARCHAR(255),
    offered_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_waitlist_quantity CHECK (quantity BETWEEN 1 AND 10)
);
-- One live place in line per account per ticket type.
CREATE UNIQUE INDEX uq_waitlist_active ON waitlist_entries (ticket_type_id, owner_email) WHERE status IN ('WAITING', 'OFFERED');
CREATE INDEX idx_waitlist_queue ON waitlist_entries (ticket_type_id, created_at) WHERE status = 'WAITING';
CREATE INDEX idx_waitlist_offered ON waitlist_entries (status) WHERE status = 'OFFERED';
CREATE INDEX idx_waitlist_owner ON waitlist_entries (owner_email, created_at DESC);
