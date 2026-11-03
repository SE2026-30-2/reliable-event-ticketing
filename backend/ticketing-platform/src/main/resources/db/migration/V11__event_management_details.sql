ALTER TABLE events ADD COLUMN category VARCHAR(40);
ALTER TABLE events ADD COLUMN sales_start_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN sales_end_at TIMESTAMPTZ;
ALTER TABLE events ADD CONSTRAINT event_sales_window CHECK (
    (sales_start_at IS NULL AND sales_end_at IS NULL) OR
    (sales_start_at IS NOT NULL AND sales_end_at IS NOT NULL AND sales_end_at > sales_start_at AND sales_end_at <= ends_at)
);

CREATE TABLE event_images (
    image_id UUID PRIMARY KEY,
    content_type VARCHAR(20) NOT NULL,
    content BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_views (
    event_id UUID PRIMARY KEY REFERENCES events(event_id),
    view_count BIGINT NOT NULL DEFAULT 0
);
