-- Payments can now be settled by an external provider (VNPay) instead of the synchronous mock, so
-- a payment has a provider-side identity and a life beyond one HTTP call.
ALTER TABLE payment_requests
    ADD COLUMN provider              VARCHAR(20)  NOT NULL DEFAULT 'MOCK',
    -- Our reference sent to the provider (vnp_TxnRef): unique, and how an IPN finds its payment.
    ADD COLUMN txn_ref               VARCHAR(64),
    ADD COLUMN provider_txn_no       VARCHAR(64),   -- provider's own transaction number (vnp_TransactionNo)
    ADD COLUMN provider_paid_at      VARCHAR(14),   -- provider's vnp_PayDate / our vnp_CreateDate, yyyyMMddHHmmss GMT+7, kept verbatim for refund/query calls
    ADD COLUMN provider_created_at   VARCHAR(14),
    ADD COLUMN pay_expires_at        TIMESTAMPTZ,   -- hosted payment page deadline (never later than the reservation hold)
    ADD COLUMN failure_reason        VARCHAR(255),
    ADD COLUMN refunded_at           TIMESTAMPTZ;
CREATE UNIQUE INDEX uq_payment_requests_txn_ref ON payment_requests (txn_ref) WHERE txn_ref IS NOT NULL;
-- Reconciliation scans PENDING rows; the partial index keeps that cheap as history grows.
CREATE INDEX idx_payment_requests_pending ON payment_requests (created_at) WHERE status = 'PENDING';
-- Statuses are now PENDING, COMPLETED, FAILED, REFUND_REQUIRED (paid, but the tickets could not be
-- issued - money to give back) and REFUNDED.
