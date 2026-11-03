UPDATE users
SET email = 'admin@ticketing.local',
    full_name = 'Reliable Event Ticketing Admin',
    updated_at = CURRENT_TIMESTAMP
WHERE id = '00000000-0000-0000-0000-000000000001';
