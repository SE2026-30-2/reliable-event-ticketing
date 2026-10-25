package com.techie.microservices.ticketing.checkin.application.port;

import java.time.Instant;

public record CheckinTimelineBucket(Instant bucketStart, long accepted, long duplicate, long rejected) {
}
