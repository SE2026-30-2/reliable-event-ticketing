-- One mock payment attempt per reservation (UNIQUE reservation_id) - a repeated POST for the same
-- reservation is idempotent at the application layer (CreatePaymentRequestApplicationService
-- returns the existing row), and this constraint is the DB-level backstop for that invariant.
CREATE TABLE payment_requests
(
    id                BIGSERIAL PRIMARY KEY,
    payment_request_id UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    reservation_id    UUID         NOT NULL UNIQUE,
    amount_cents      BIGINT       NOT NULL,
    status            VARCHAR(20)  NOT NULL, -- PENDING, COMPLETED, FAILED
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at       TIMESTAMPTZ,
    CONSTRAINT chk_amount_positive CHECK (amount_cents > 0)
);
