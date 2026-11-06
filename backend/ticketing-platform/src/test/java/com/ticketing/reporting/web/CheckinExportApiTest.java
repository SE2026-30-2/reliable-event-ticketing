package com.ticketing.reporting.web;

import com.ticketing.catalog.application.port.EventRepositoryPort;
import com.ticketing.catalog.application.service.EventAccessApplicationService;
import com.ticketing.catalog.domain.model.Event;
import com.ticketing.reporting.application.EventReportService;
import com.ticketing.shared.config.CorsConfig;
import com.ticketing.shared.config.SecurityConfig;
import com.ticketing.shared.web.ManagementAccess;
import com.ticketing.shared.web.error.GlobalExceptionHandler;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import java.util.Optional;
import java.util.UUID;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

/** Real controller/security/policy/JDBC; only JWT verification and event lookup are doubles. */
@WebMvcTest(ReportController.class)
@Import({SecurityConfig.class, CorsConfig.class, ManagementAccess.class, GlobalExceptionHandler.class,
        EventAccessApplicationService.class, EventReportService.class, CheckinExportApiTest.Db.class,
        com.ticketing.shared.web.ratelimit.InMemoryRateLimiter.class})
class CheckinExportApiTest {
    static final UUID A = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID B = UUID.fromString("00000000-0000-0000-0000-000000000002");
    static final String URL = "/api/manage/events/{id}/checkins.csv";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockBean EventRepositoryPort events;

    @TestConfiguration static class Db {
        @Bean JdbcTemplate jdbcTemplate() {
            JdbcDataSource ds = new JdbcDataSource();
            ds.setURL("jdbc:h2:mem:vt047api;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
            return new JdbcTemplate(ds);
        }
    }

    @BeforeEach void setup() {
        jdbc.execute("DROP TABLE IF EXISTS checkin_records");
        jdbc.execute("CREATE TABLE checkin_records (id BIGINT PRIMARY KEY, event_id UUID, ticket_id UUID, device_id UUID, outcome VARCHAR(30) NOT NULL, server_received_at TIMESTAMP WITH TIME ZONE NOT NULL)");
        jdbc.update("INSERT INTO checkin_records VALUES (1, ?, ?, NULL, 'ACCEPTED', TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+00')", A, A);
        jdbc.update("INSERT INTO checkin_records VALUES (2, ?, ?, NULL, 'DUPLICATE', TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+00')", B, B);
        when(events.findByEventId(any())).thenReturn(Optional.empty());
        when(events.findByEventId(A)).thenReturn(Optional.of(Event.builder().eventId(A).organizerId("owner@test.invalid").build()));
        when(events.findByEventId(B)).thenReturn(Optional.of(Event.builder().eventId(B).organizerId("other@test.invalid").build()));
    }
    private static org.springframework.test.web.servlet.request.RequestPostProcessor as(String email, String role) {
        return jwt().jwt(j -> j.subject(email)).authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
    @Test void T01_anonymousDenied() throws Exception { mvc.perform(get(URL, A)).andExpect(status().isUnauthorized()); }
    @Test void T02_buyerDenied() throws Exception { mvc.perform(get(URL, A).with(as("buyer@test.invalid","USER"))).andExpect(status().isForbidden()); }
    @Test void T03_ownerDownloadsOnlyOwnRows() throws Exception {
        mvc.perform(get(URL,A).with(as("OWNER@test.invalid","ORGANIZER")))
                .andExpect(status().isOk()).andExpect(content().contentType("text/csv;charset=UTF-8"))
                .andExpect(header().string("Content-Disposition",containsString("checkins-"+A+".csv")))
                .andExpect(header().string("Cache-Control","no-store"))
                .andExpect(content().string(startsWith("\uFEFFid,ticket_id,device_id,outcome,server_received_at\r\n")))
                .andExpect(content().string(containsString("1,"+A+",,ACCEPTED,2026-01-01T00:00:00Z\r\n")))
                .andExpect(content().string(not(containsString(B.toString()))));
    }
    @Test void T04_foreignOrganizerGets404() throws Exception { mvc.perform(get(URL,B).with(as("owner@test.invalid","ORGANIZER"))).andExpect(status().isNotFound()); }
    @Test void T05_adminStillGetsOnlyRequestedEvent() throws Exception {
        mvc.perform(get(URL,B).with(as("root@test.invalid","ADMIN"))).andExpect(status().isOk())
                .andExpect(content().string(containsString("DUPLICATE"))).andExpect(content().string(not(containsString(A.toString()))));
    }
    @Test void T06_missingEventGets404() throws Exception { mvc.perform(get(URL,new UUID(0,99)).with(as("root@test.invalid","ADMIN"))).andExpect(status().isNotFound()); }
    @Test void T07_invalidUuidGets400() throws Exception { mvc.perform(get(URL,"invalid").with(as("root@test.invalid","ADMIN"))).andExpect(status().isBadRequest()); }
    @Test void T08_databaseContractFailureIsNotCsvSuccess() throws Exception {
        jdbc.execute("ALTER TABLE checkin_records DROP COLUMN outcome");
        mvc.perform(get(URL,A).with(as("owner@test.invalid","ORGANIZER"))).andExpect(status().isServiceUnavailable())
                .andExpect(header().doesNotExist("Content-Disposition"))
                .andExpect(content().string(not(containsString("SELECT"))));
    }
}
