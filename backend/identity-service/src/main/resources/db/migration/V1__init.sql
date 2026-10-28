-- users: the account itself. email is the identity carried as the JWT subject everywhere else in
-- the system (see cart-service's CartController, order-service's OrderRequest.userDetails.email).
CREATE TABLE users
(
    id                    UUID PRIMARY KEY,
    email                 VARCHAR(255) NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    full_name             VARCHAR(255) NOT NULL,
    status                VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
    email_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive uniqueness: register/login both normalize to lower(email) in application code,
-- but a unique index on the raw column would still allow two rows differing only by case to slip
-- in through any path that skips normalization - this index closes that gap at the DB level.
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));

-- user_roles: plain role names (USER, ADMIN, ...), no ROLE_ prefix - every resource-server service
-- adds that prefix itself via its own JwtGrantedAuthoritiesConverter (see e.g. product-service's
-- SecurityConfig). A simple element-collection table rather than a full roles/permissions schema:
-- this system only ever checks a fixed, small set of role names via hasRole(...).
CREATE TABLE user_roles
(
    user_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role    VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, role)
);

-- refresh_tokens: one row per issued refresh token. Only token_hash (SHA-256 of the raw opaque
-- token handed to the client) is ever stored - see infrastructure.security.Sha256TokenHashingAdapter.
-- Rotated (revoked) on every use (UserApplicationService#refresh) and revoked in bulk on logout-
-- everywhere-equivalent events (password reset, admin lock).
CREATE TABLE refresh_tokens
(
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP    NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);

-- user_tokens: single-use, hashed, expiring tokens backing both the email-verification and
-- password-reset flows (discriminated by "type"). Only token_hash is ever stored, for the same
-- reason as refresh_tokens.
CREATE TABLE user_tokens
(
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    type       VARCHAR(30)  NOT NULL,
    expires_at TIMESTAMP    NOT NULL,
    used_at    TIMESTAMP,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_tokens_user_id_type ON user_tokens (user_id, type);

-- Outbox pattern infrastructure, mirroring payment-service/order-service: a row is written in the
-- SAME local transaction as the change it announces (account creation, forgot-password request);
-- infrastructure.messaging.OutboxRelayPublisher relays unpublished rows to Kafka and then stamps
-- published_at - this is what makes the DB write and the Kafka publish atomic without a
-- distributed transaction. Unlike every saga-participant service, this service never consumes
-- Kafka events (it is the auth source of truth, not a saga step), so there is no processed_events
-- table here.
CREATE TABLE outbox_events
(
    id           BIGSERIAL PRIMARY KEY,
    event_id     UUID         NOT NULL UNIQUE,
    aggregate_id VARCHAR(255) NOT NULL,
    event_type   VARCHAR(100) NOT NULL,
    topic        VARCHAR(100) NOT NULL,
    payload      TEXT         NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);

CREATE INDEX idx_outbox_events_unpublished ON outbox_events (id) WHERE published_at IS NULL;
