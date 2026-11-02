package com.techie.microservices.ticketing.reporting.web;

import com.techie.microservices.ticketing.reporting.application.EventAnalyticsService;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class EventAnalyticsController {
    private final EventAnalyticsService service;
    private final ManagementAccess access;
    @PostMapping("/api/event/{eventId}/views")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void view(@PathVariable UUID eventId) { service.recordView(eventId); }

    @GetMapping("/api/manage/events/{eventId}/analytics")
    public EventAnalyticsService.Analytics analytics(@PathVariable UUID eventId,
            @RequestParam(defaultValue = "7") int days, @RequestParam(defaultValue = "Asia/Ho_Chi_Minh") String timezone,
            @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        return service.analytics(eventId, days, timezone);
    }
}
