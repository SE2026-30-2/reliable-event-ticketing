package com.techie.microservices.ticketing.reporting.web;

import com.techie.microservices.ticketing.reporting.application.EventReportService;
import com.techie.microservices.ticketing.reporting.application.EventReportService.EventReport;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** ADMIN or the event's ORGANIZER (see SecurityConfig for /api/manage/** and ManagementAccess for the per-event rule). */
@RestController
@RequiredArgsConstructor
public class ReportController {

    private static final MediaType CSV = new MediaType("text", "csv", StandardCharsets.UTF_8);

    private final EventReportService reportService;
    private final ManagementAccess access;

    @GetMapping("/api/manage/events/{eventId}/report")
    public EventReport report(@PathVariable UUID eventId, @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        return reportService.report(eventId);
    }

    @GetMapping("/api/manage/events/{eventId}/attendees.csv")
    public ResponseEntity<StreamingResponseBody> attendees(@PathVariable UUID eventId, @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        return csv("attendees-" + eventId + ".csv", out -> reportService.writeAttendeesCsv(eventId, new OutputStreamWriter(out, StandardCharsets.UTF_8)));
    }

    @GetMapping("/api/manage/events/{eventId}/payments.csv")
    public ResponseEntity<StreamingResponseBody> payments(@PathVariable UUID eventId, @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        return csv("payments-" + eventId + ".csv", out -> reportService.writePaymentsCsv(eventId, new OutputStreamWriter(out, StandardCharsets.UTF_8)));
    }

    private static ResponseEntity<StreamingResponseBody> csv(String filename, StreamingResponseBody body) {
        return ResponseEntity.ok()
                .contentType(CSV)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .body(body);
    }
}
