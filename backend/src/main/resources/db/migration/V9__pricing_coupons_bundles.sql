-- What each ticket was actually sold for (after any coupon). The payable total of a reservation is the
-- sum of its tickets' prices, so a later price change or a coupon never alters an existing hold.
ALTER TABLE tickets ADD COLUMN price_cents BIGINT NOT NULL DEFAULT 0;
UPDATE tickets t SET price_cents = tt.price_cents FROM ticket_types tt WHERE tt.ticket_type_id = t.ticket_type_id;
ALTER TABLE tickets ADD COLUMN coupon_id UUID;

-- Bundles: one "unit" of this type is bundle_size tickets sold together at price_cents (e.g. a group of 4).
-- Quota counts tickets, not units.
ALTER TABLE ticket_types ADD COLUMN bundle_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ticket_types ADD CONSTRAINT chk_bundle_size CHECK (bundle_size BETWEEN 1 AND 20);

-- A fully discounted order costs nothing and completes without a payment provider.
ALTER TABLE payment_requests DROP CONSTRAINT chk_amount_positive;
ALTER TABLE payment_requests ADD CONSTRAINT chk_amount_nonneg CHECK (amount_cents >= 0);

CREATE TABLE coupons
(
    id              BIGSERIAL PRIMARY KEY,
    coupon_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_id        UUID         NOT NULL REFERENCES events (event_id),
    code            VARCHAR(40)  NOT NULL,                 -- stored upper-case
    discount_type   VARCHAR(10)  NOT NULL,                 -- PERCENT (1..100) | FIXED (per ticket unit, in cents)
    discount_value  BIGINT       NOT NULL,
    ticket_type_id  UUID,                                  -- NULL = any ticket type of the event
    max_redemptions INTEGER,                               -- NULL = unlimited; counted per reservation
    redeemed_count  INTEGER      NOT NULL DEFAULT 0,
    valid_from      TIMESTAMPTZ,
    valid_until     TIMESTAMPTZ,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_coupon_code UNIQUE (event_id, code),
    CONSTRAINT chk_discount_type CHECK (discount_type IN ('PERCENT', 'FIXED')),
    CONSTRAINT chk_discount_value CHECK (discount_value > 0 AND (discount_type = 'FIXED' OR discount_value <= 100)),
    CONSTRAINT chk_redeemed_nonneg CHECK (redeemed_count >= 0),
    CONSTRAINT chk_redeemed_le_max CHECK (max_redemptions IS NULL OR redeemed_count <= max_redemptions)
);
CREATE INDEX idx_coupons_event ON coupons (event_id);
