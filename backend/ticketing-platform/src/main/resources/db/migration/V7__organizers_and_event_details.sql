-- Multi-organizer: every event belongs to the account (JWT subject, lower-cased) that created it.
-- NULL = created before organizers existed: manageable by ADMIN only.
ALTER TABLE events ADD COLUMN organizer_id VARCHAR(255);
ALTER TABLE events ADD COLUMN description TEXT;
ALTER TABLE events ADD COLUMN banner_url VARCHAR(500);
CREATE INDEX idx_events_organizer ON events (organizer_id);
-- The public listing: PUBLISHED events that have not ended, soonest first.
CREATE INDEX idx_events_public ON events (status, ends_at);

-- Who registered a device (audit; an organizer may only see/revoke devices of their own events).
ALTER TABLE checkin_devices ADD COLUMN created_by VARCHAR(255);
