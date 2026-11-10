-- Records when a buyer leaves a WAITING entry so the service can enforce a bounded undo window.
-- OFFERED declines intentionally keep this NULL because their reservation is released immediately.
ALTER TABLE waitlist_entries
    ADD COLUMN cancelled_at TIMESTAMPTZ;
