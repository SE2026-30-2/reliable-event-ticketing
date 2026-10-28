package com.ticketing.platform.shared.web.ratelimit;

/**
 * Counts hits per key in a fixed window. The seam exists so the in-memory implementation (one app
 * instance) can be replaced by a shared store (Redis, ...) when the app runs as several instances,
 * without touching the filter or its rules.
 */
public interface RateLimiter {

    /** Registers one hit for {@code key}; {@code max} is how many the key may make per window. */
    Decision tryAcquire(String key, int max);

    record Decision(boolean allowed, long retryAfterSeconds) {
    }
}
