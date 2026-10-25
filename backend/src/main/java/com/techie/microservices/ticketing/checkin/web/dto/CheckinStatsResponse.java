package com.techie.microservices.ticketing.checkin.web.dto;

import com.techie.microservices.ticketing.checkin.application.port.CheckinStats;

import java.util.UUID;

public record CheckinStatsResponse(
        UUID eventId, long totalIssued, long acceptedCount, long duplicateCount,
        long deviceRejectedCount, long invalidCount
) {
    public static CheckinStatsResponse from(CheckinStats stats) {
        return new CheckinStatsResponse(stats.eventId(), stats.totalIssued(), stats.acceptedCount(),
                stats.duplicateCount(), stats.deviceRejectedCount(), stats.invalidCount());
    }
}
