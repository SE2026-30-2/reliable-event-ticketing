package com.techie.microservices.ticketing.checkin.web;

import com.techie.microservices.ticketing.checkin.application.port.CheckinTimelineBucket;
import com.techie.microservices.ticketing.checkin.application.port.GetCheckinStatsUseCase;
import com.techie.microservices.ticketing.checkin.application.port.GetCheckinTimelineUseCase;
import com.techie.microservices.ticketing.checkin.web.dto.CheckinStatsResponse;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** ADMIN, or the ORGANIZER of that event - see SecurityConfig and ManagementAccess. */
@RestController
@RequiredArgsConstructor
public class CheckinDashboardController {

    private final GetCheckinStatsUseCase getCheckinStatsUseCase;
    private final GetCheckinTimelineUseCase getCheckinTimelineUseCase;
    private final ManagementAccess access;

    @GetMapping("/api/checkin/events/{eventId}/stats")
    public CheckinStatsResponse getStats(@PathVariable UUID eventId, @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        return CheckinStatsResponse.from(getCheckinStatsUseCase.getStats(eventId));
    }

    @GetMapping("/api/checkin/events/{eventId}/timeline")
    public List<CheckinTimelineBucket> getTimeline(@PathVariable UUID eventId,
                                                   @RequestParam(defaultValue = "15") int bucketMinutes,
                                                   @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        access.assertCanManage(eventId, jwt, authentication);
        return getCheckinTimelineUseCase.getTimeline(eventId, bucketMinutes);
    }
}
