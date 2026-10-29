-- Ticket lifecycle features: transfers, guest (comp) tickets, multi-entry passes.

-- A transfer voids the old ticket (status TRANSFERRED) and issues a NEW one - new id, new QR - so the
-- old QR dies. source tells how a ticket came to exist; transferred_from links the chain.
ALTER TABLE tickets ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'PURCHASE'; -- PURCHASE | GUEST | TRANSFER
ALTER TABLE tickets ADD COLUMN transferred_from UUID;
ALTER TABLE tickets ADD COLUMN transfer_count INTEGER NOT NULL DEFAULT 0;

-- Multi-entry: how many times one ticket may be scanned in (1 = a normal single-use ticket). Copied
-- onto each ticket at reservation and signed into its QR (claim "me", omitted when 1).
ALTER TABLE ticket_types ADD COLUMN max_entries INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ticket_types ADD CONSTRAINT chk_max_entries CHECK (max_entries BETWEEN 1 AND 50);
ALTER TABLE tickets ADD COLUMN max_entries INTEGER NOT NULL DEFAULT 1;

-- Anti-replay generalised from "one ACCEPTED row per ticket" to "one per (ticket, entry number)".
-- Writers serialise per ticket with an advisory lock and number the entry themselves; this unique
-- index is the backstop that makes a double-count impossible even if that logic were wrong.
ALTER TABLE checkin_records ADD COLUMN entry_no INTEGER;
UPDATE checkin_records SET entry_no = 1 WHERE outcome = 'ACCEPTED';
DROP INDEX idx_checkin_records_accepted_ticket;
CREATE UNIQUE INDEX idx_checkin_records_accepted_entry ON checkin_records (ticket_id, entry_no) WHERE outcome = 'ACCEPTED';
