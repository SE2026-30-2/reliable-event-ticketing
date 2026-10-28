package com.ticketing.identity.config;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private static final String LIMITED_PATH = "/api/user/register";
    private static final String UNLIMITED_PATH = "/api/user/login";

    private final MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(3, 60, new ObjectMapper(), clock);
    }

    @Test
    void allowsRequestsUpToTheLimitThenRejects() throws Exception {
        for (int i = 0; i < 3; i++) {
            assertThat(callAndDidChainRun(LIMITED_PATH, "1.2.3.4")).isTrue();
        }

        MockHttpServletResponse response = call(LIMITED_PATH, "1.2.3.4");

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getContentAsString()).contains("Too many requests");
    }

    @Test
    void tracksDifferentClientIpsIndependently() throws Exception {
        for (int i = 0; i < 3; i++) {
            assertThat(callAndDidChainRun(LIMITED_PATH, "1.1.1.1")).isTrue();
        }

        // A different IP hitting the same route still has its own, untouched quota.
        assertThat(callAndDidChainRun(LIMITED_PATH, "2.2.2.2")).isTrue();
    }

    @Test
    void resetsTheCounterOnceTheWindowElapses() throws Exception {
        for (int i = 0; i < 3; i++) {
            assertThat(callAndDidChainRun(LIMITED_PATH, "3.3.3.3")).isTrue();
        }
        assertThat(call(LIMITED_PATH, "3.3.3.3").getStatus()).isEqualTo(429);

        clock.advanceSeconds(61);

        assertThat(callAndDidChainRun(LIMITED_PATH, "3.3.3.3")).isTrue();
    }

    @Test
    void doesNotLimitRoutesOutsideTheConfiguredList() throws Exception {
        for (int i = 0; i < 10; i++) {
            assertThat(callAndDidChainRun(UNLIMITED_PATH, "4.4.4.4")).isTrue();
        }
    }

    @Test
    void doesNotLimitGetRequestsToALimitedPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", LIMITED_PATH);
        request.setRemoteAddr("5.5.5.5");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    private boolean callAndDidChainRun(String path, String remoteAddr) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr(remoteAddr);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        return chain.getRequest() != null;
    }

    private MockHttpServletResponse call(String path, String remoteAddr) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr(remoteAddr);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        return response;
    }

    /** A {@link Clock} whose current instant can be moved forward, to test window expiry. */
    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advanceSeconds(long seconds) {
            this.instant = this.instant.plusSeconds(seconds);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
