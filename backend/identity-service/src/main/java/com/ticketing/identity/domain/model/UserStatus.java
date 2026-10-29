package com.ticketing.identity.domain.model;

/**
 * ACTIVE: normal login allowed. LOCKED: login rejected (423) regardless of password correctness -
 * set automatically after too many consecutive failed login attempts (see UserApplicationService)
 * or manually by an admin; cleared by an admin via PATCH /api/user/admin/users/{id}/status, or
 * automatically on a successful password reset (proves control of the account's email).
 */
public enum UserStatus {
    ACTIVE,
    LOCKED
}
