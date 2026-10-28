-- The buyer account (user-service JWT subject, lower-cased) that reserved the ticket. Distinct from
-- holder_email, which is only where the ticket is delivered and may be someone else (a gift).
-- NULL = tickets created before accounts existed (anonymous purchases): readable by ADMIN only.
ALTER TABLE tickets ADD COLUMN owner_email VARCHAR(255);
CREATE INDEX idx_tickets_owner ON tickets (owner_email, created_at DESC);
