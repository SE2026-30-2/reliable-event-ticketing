package com.ticketing.platform.shared.web.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.platform.shared.web.error.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Per-client-IP fixed-window rate limit on the state-changing buyer endpoints (reserve, pay, resend
 * - the last also stops the app being used to mail-bomb a holder) - without it one script can hold a whole ticket type's quota hostage for the
 * reservation window, or hammer the payment gateway. Counters are in-memory per instance: good
 * enough for one app instance; a multi-instance deployment replaces {@link InMemoryRateLimiter} with a
 * shared-store {@link RateLimiter} (e.g. Redis) or enforces limits at the reverse proxy instead.
 * <p>
 * The client IP is {@code getRemoteAddr()} unless {@code ticketing.rate-limit.trust-forwarded-for}
 * is true (set it ONLY behind a reverse proxy that overwrites {@code X-Forwarded-For} - otherwise
 * any client could pick its own "IP" and bypass the limit; left false, every client behind a
 * proxy would instead share one bucket).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private record Rule(HttpMethod method, String pattern, String name, int max) {
    }

    private final AntPathMatcher matcher = new AntPathMatcher();
    private final List<Rule> rules;
    private final boolean trustForwardedFor;
    private final ObjectMapper objectMapper;
    private final RateLimiter rateLimiter;

    @Autowired
    public RateLimitFilter(
            @Value("${ticketing.rate-limit.reservations-per-window:10}") int reservationsPerWindow,
            @Value("${ticketing.rate-limit.payments-per-window:20}") int paymentsPerWindow,
            @Value("${ticketing.rate-limit.resends-per-window:5}") int resendsPerWindow,
            @Value("${ticketing.rate-limit.transfers-per-window:5}") int transfersPerWindow,
            @Value("${ticketing.rate-limit.waitlist-per-window:10}") int waitlistPerWindow,
            @Value("${ticketing.rate-limit.trust-forwarded-for:false}") boolean trustForwardedFor,
            ObjectMapper objectMapper,
            RateLimiter rateLimiter) {
        this.rules = List.of(
                new Rule(HttpMethod.POST, "/api/ticket-types/*/reservations", "reserve", reservationsPerWindow),
                new Rule(HttpMethod.POST, "/api/payment/requests", "pay", paymentsPerWindow),
                new Rule(HttpMethod.POST, "/api/ticket/*/resend", "resend", resendsPerWindow),
                new Rule(HttpMethod.POST, "/api/ticket/*/transfer", "transfer", transfersPerWindow),
                new Rule(HttpMethod.POST, "/api/ticket-types/*/waitlist", "waitlist", waitlistPerWindow));
        this.trustForwardedFor = trustForwardedFor;
        this.objectMapper = objectMapper;
        this.rateLimiter = rateLimiter;
    }

    /** For tests: in-memory limiter on the given clock, default limits for the newer rules. */
    RateLimitFilter(int reservationsPerWindow, int paymentsPerWindow, int resendsPerWindow, long windowSeconds,
                    boolean trustForwardedFor, ObjectMapper objectMapper, Clock clock) {
        this(reservationsPerWindow, paymentsPerWindow, resendsPerWindow, 5, 10, trustForwardedFor, objectMapper,
                new InMemoryRateLimiter(windowSeconds * 1000L, clock));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Rule rule = matchingRule(request);
        if (rule == null) {
            chain.doFilter(request, response);
            return;
        }
        RateLimiter.Decision decision = rateLimiter.tryAcquire(rule.name() + '|' + clientIp(request), rule.max());
        if (decision.allowed()) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", String.valueOf(decision.retryAfterSeconds()));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(),
                ErrorResponse.of(HttpStatus.TOO_MANY_REQUESTS, "Too many requests - please try again later"));
    }

    private Rule matchingRule(HttpServletRequest request) {
        for (Rule rule : rules) {
            if (rule.method().matches(request.getMethod()) && matcher.match(rule.pattern(), request.getRequestURI())) {
                return rule;
            }
        }
        return null;
    }

    private String clientIp(HttpServletRequest request) {
        if (trustForwardedFor) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                // Left-most entry is the original client when the proxy appends to the chain.
                return forwarded.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
}
