package com.techie.microservices.ticketing.shared.web;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class CorrelationIdFilterTest {

    private final CorrelationIdFilter filter = new CorrelationIdFilter();

    private String run(String suppliedHeader, AtomicReference<String> mdcSeenByHandler, MockHttpServletResponse res) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/event");
        if (suppliedHeader != null) req.addHeader(CorrelationIdFilter.HEADER, suppliedHeader);
        FilterChain chain = (r, s) -> mdcSeenByHandler.set(MDC.get(CorrelationIdFilter.MDC_KEY));
        filter.doFilter(req, res, chain);
        return res.getHeader(CorrelationIdFilter.HEADER);
    }

    @Test
    void generatesAnIdExposesItInMdcDuringTheRequestAndClearsItAfterwards() throws Exception {
        AtomicReference<String> seen = new AtomicReference<>();
        String header = run(null, seen, new MockHttpServletResponse());

        assertThat(header).isNotBlank();
        assertThat(seen.get()).isEqualTo(header);
        assertThat(MDC.get(CorrelationIdFilter.MDC_KEY)).isNull();
    }

    @Test
    void reusesASafeCallerSuppliedId() throws Exception {
        AtomicReference<String> seen = new AtomicReference<>();
        assertThat(run("trace-abc_123.9", seen, new MockHttpServletResponse())).isEqualTo("trace-abc_123.9");
        assertThat(seen.get()).isEqualTo("trace-abc_123.9");
    }

    @Test
    void replacesAnUnsafeIdInsteadOfWritingItIntoTheLogs() throws Exception {
        String forged = "x\nINFO fake line";
        String header = run(forged, new AtomicReference<>(), new MockHttpServletResponse());
        assertThat(header).isNotEqualTo(forged).doesNotContain("\n");
    }
}
