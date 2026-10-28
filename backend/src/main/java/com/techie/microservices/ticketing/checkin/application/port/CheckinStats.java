package com.techie.microservices.ticketing.checkin.application.port;

import java.util.UUID;

public record CheckinStats(
        UUID eventId,
        long totalIssued,
        long acceptedCount,
        long duplicateCount,
        long deviceRejectedCount,
        long invalidCount
) {
}
