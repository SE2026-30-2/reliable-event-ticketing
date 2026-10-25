package com.techie.microservices.ticketing.shared.web.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class RateLimitFilterTest {

    private final FilterChain chain = mock(FilterChain.class);

    private RateLimitFilter filter(boolean trustForwarded, Clock clock) {
        return new RateLimitFilter(2, 3, 2, 60, trustForwarded, new ObjectMapper().findAndRegisterModules(), clock);
    }

    private MockHttpServletResponse call(RateLimitFilter f, String method, String uri, String ip, String forwarded) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        req.setRemoteAddr(ip);
        if (forwarded != null) req.addHeader("X-Forwarded-For", forwarded);
        MockHttpServletResponse res = new MockHttpServletResponse();
        f.doFilter(req, res, chain);
        return res;
    }

    @Test
    void blocksTheRequestOverTheLimitWithRetryAfterAndLeavesOtherClientsAlone() throws Exception {
        RateLimitFilter f = filter(false, Clock.systemUTC());
        String uri = "/api/ticket-types/abc/reservations";

        assertThat(call(f, "POST", uri, "1.1.1.1", null).getStatus()).isEqualTo(200);
        assertThat(call(f, "POST", uri, "1.1.1.1", null).getStatus()).isEqualTo(200);
        MockHttpServletResponse blocked = call(f, "POST", uri, "1.1.1.1", null);

        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(Long.parseLong(blocked.getHeader("Retry-After"))).isBetween(1L, 60L);
        assertThat(call(f, "POST", uri, "2.2.2.2", null).getStatus()).isEqualTo(200);
        verify(chain, times(3)).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void theWindowResetsAfterItElapses() throws Exception {
        MutableClock clock = new MutableClock();
        RateLimitFilter f = filter(false, clock);
        String uri = "/api/payment/requests";
        for (int i = 0; i < 3; i++) call(f, "POST", uri, "1.1.1.1", null);
        assertThat(call(f, "POST", uri, "1.1.1.1", null).getStatus()).isEqualTo(429);

        clock.advanceSeconds(61);

        assertThat(call(f, "POST", uri, "1.1.1.1", null).getStatus()).isEqualTo(200);
    }

    @Test
    void doesNotLimitReadsOrOtherEndpoints() throws Exception {
        RateLimitFilter f = filter(false, Clock.systemUTC());
        for (int i = 0; i < 20; i++) {
            assertThat(call(f, "GET", "/api/event", "1.1.1.1", null).getStatus()).isEqualTo(200);
            assertThat(call(f, "POST", "/api/checkin", "1.1.1.1", null).getStatus()).isEqualTo(200);
        }
    }

    @Test
    void ignoresForwardedForUnlessTrustedSoClientsCannotPickTheirOwnBucket() throws Exception {
        String uri = "/api/ticket-types/abc/reservations";
        RateLimitFilter untrusting = filter(false, Clock.systemUTC());
        call(untrusting, "POST", uri, "9.9.9.9", "10.0.0.1");
        call(untrusting, "POST", uri, "9.9.9.9", "10.0.0.2");
        // Spoofing a fresh X-Forwarded-For does not escape the bucket keyed on the real peer.
        assertThat(call(untrusting, "POST", uri, "9.9.9.9", "10.0.0.3").getStatus()).isEqualTo(429);

        RateLimitFilter trusting = filter(true, Clock.systemUTC());
        call(trusting, "POST", uri, "9.9.9.9", "10.0.0.1");
        call(trusting, "POST", uri, "9.9.9.9", "10.0.0.1");
        assertThat(call(trusting, "POST", uri, "9.9.9.9", "10.0.0.1").getStatus()).isEqualTo(429);
        assertThat(call(trusting, "POST", uri, "9.9.9.9", "10.0.0.2").getStatus()).isEqualTo(200);
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2030-01-01T00:00:00Z");

        void advanceSeconds(long s) {
            now = now.plusSeconds(s);
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
