package com.ticketing.checkin.application.port;

import java.util.UUID;

public interface GetCheckinStatsUseCase {
    CheckinStats getStats(UUID eventId);
}
