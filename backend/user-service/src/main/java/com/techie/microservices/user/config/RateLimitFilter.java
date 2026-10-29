package com.techie.microservices.user.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techie.microservices.user.web.error.ErrorResponse;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Fixed-window rate limiter, keyed by client IP, applied only to the three unauthenticated (or
 * self-service) account-lifecycle endpoints that have no other limit on repeated calls:
 * {@code /api/user/register}, {@code /api/user/password/forgot} and
 * {@code /api/user/email/verify/resend}. Without this, any of the three can be spammed - flooding
 * Mailtrap with verification/reset emails, or (for register) cheaply probing whether an email is
 * already taken via the 409 response.
 * <p>
 * Deliberately in-memory and per-instance (a plain {@link ConcurrentHashMap}, not Redis/Bucket4j)
 * rather than a distributed store: this mirrors every other piece of in-memory state in this
 * service (the RSA signing key, the account-lockout counter is the one exception - that one is
 * persisted precisely because it is a security-relevant, permanent-until-unlocked decision) and
 * this project has no multi-instance deployment of user-service to begin with (see
 * RsaKeyProvider's own multi-instance caveat). A restart clears every counter, which only ever
 * makes the limit more permissive, never less.
 * <p>
 * Client IP comes from {@link HttpServletRequest#getRemoteAddr()}, i.e. whoever is directly
 * connected to this container - not an {@code X-Forwarded-For} header, since that header is
 * trivially spoofable by any caller unless a trusted reverse proxy is configured to strip/set it,
 * and no such proxy trust configuration exists anywhere in this project. In the docker-compose
 * deployment every request arrives from api-gateway's container IP, so this limiter's real
 * granularity there is "per upstream gateway", not "per end-user IP" - still enough to stop a
 * single runaway/malicious client loop, but not a distributed one spread across many real end-user
 * IPs. Tightening this further (honoring a trusted-proxy-set header) is a separate change.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Map<String, HttpMethod> LIMITED_ROUTES = Map.of(
            "/api/user/register", HttpMethod.POST,
            "/api/user/password/forgot", HttpMethod.POST,
            "/api/user/email/verify/resend", HttpMethod.POST);

    private final int maxRequestsPerWindow;
    private final long windowMillis;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(int maxRequestsPerWindow, long windowSeconds, ObjectMapper objectMapper) {
        this(maxRequestsPerWindow, windowSeconds, objectMapper, Clock.systemUTC());
    }

    RateLimitFilter(int maxRequestsPerWindow, long windowSeconds, ObjectMapper objectMapper, Clock clock) {
        this.maxRequestsPerWindow = maxRequestsPerWindow;
        this.windowMillis = windowSeconds * 1000L;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        HttpMethod limitedMethod = LIMITED_ROUTES.get(request.getRequestURI());
        if (limitedMethod == null || !limitedMethod.matches(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = request.getRequestURI() + '|' + request.getRemoteAddr();
        if (tryConsume(key)) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(),
                ErrorResponse.of("Too many requests - please try again later"));
    }

    private boolean tryConsume(String key) {
        long now = clock.millis();
        Window window = windows.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStart >= windowMillis) {
                return new Window(now);
            }
            return existing;
        });
        return window.count.incrementAndGet() <= maxRequestsPerWindow;
    }

    /** Package-private for tests; not exposed outside this filter. */
    Set<String> trackedKeys() {
        return windows.keySet();
    }

    private static final class Window {
        private final long windowStart;
        private final AtomicInteger count = new AtomicInteger(0);

        private Window(long windowStart) {
            this.windowStart = windowStart;
        }
    }
}
