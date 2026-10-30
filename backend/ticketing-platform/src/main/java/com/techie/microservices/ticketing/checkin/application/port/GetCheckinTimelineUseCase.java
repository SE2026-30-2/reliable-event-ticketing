package com.techie.microservices.ticketing.checkin.application.port;

import java.util.List;
import java.util.UUID;

public interface GetCheckinTimelineUseCase {
    /** Check-in attempts per time bucket, oldest first; buckets with no attempts are omitted. */
    List<CheckinTimelineBucket> getTimeline(UUID eventId, int bucketMinutes);
}
