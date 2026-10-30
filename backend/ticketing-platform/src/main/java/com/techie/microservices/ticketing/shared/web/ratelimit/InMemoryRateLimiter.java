package com.techie.microservices.ticketing.shared.web.ratelimit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/** Fixed-window counters held in this JVM - correct for a single instance only. */
@Component
public class InMemoryRateLimiter implements RateLimiter {

    private static final int EVICT_THRESHOLD = 10_000;

    private final long windowMillis;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private static final class Window {
        final long start;
        final AtomicInteger count = new AtomicInteger();

        Window(long start) {
            this.start = start;
        }
    }

    @Autowired
    public InMemoryRateLimiter(@Value("${ticketing.rate-limit.window-seconds:60}") long windowSeconds) {
        this(windowSeconds * 1000L, Clock.systemUTC());
    }

    InMemoryRateLimiter(long windowMillis, Clock clock) {
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    @Override
    public Decision tryAcquire(String key, int max) {
        long now = clock.millis();
        if (windows.size() > EVICT_THRESHOLD) {
            windows.values().removeIf(w -> now - w.start >= windowMillis);
        }
        Window window = windows.compute(key, (k, existing) ->
                existing == null || now - existing.start >= windowMillis ? new Window(now) : existing);
        if (window.count.incrementAndGet() <= max) {
            return new Decision(true, 0);
        }
        return new Decision(false, Math.max(1, (window.start + windowMillis - now + 999) / 1000));
    }
}
