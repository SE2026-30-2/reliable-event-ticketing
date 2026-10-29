package com.techie.microservices.ticketing.checkin.application.service;

import com.techie.microservices.ticketing.checkin.application.port.CheckinTimelineBucket;
import com.techie.microservices.ticketing.checkin.application.port.GetCheckinTimelineUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Buckets by when the scan actually happened at the gate, not when it reached the server - a
 * device that was offline for an hour and then synced would otherwise paint a single huge spike.
 * The device's clock is untrusted, so it is clamped to never be later than the server receipt
 * (and a missing client time falls back to the receipt). It only shapes this chart; it never
 * decides who gets in.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetCheckinTimelineApplicationService implements GetCheckinTimelineUseCase {

    private final JdbcTemplate jdbc;

    @Override
    public List<CheckinTimelineBucket> getTimeline(UUID eventId, int bucketMinutes) {
        int bucket = Math.max(1, Math.min(bucketMinutes, 24 * 60));
        long seconds = bucket * 60L;
        return jdbc.query("""
                        SELECT to_timestamp(floor(extract(epoch FROM LEAST(COALESCE(client_checkin_at, server_received_at), server_received_at)) / ?) * ?) AS bucket,
                               count(*) FILTER (WHERE outcome = 'ACCEPTED')  AS accepted,
                               count(*) FILTER (WHERE outcome = 'DUPLICATE') AS duplicate,
                               count(*) FILTER (WHERE outcome NOT IN ('ACCEPTED', 'DUPLICATE')) AS rejected
                        FROM checkin_records
                        WHERE event_id = ?
                        GROUP BY 1
                        ORDER BY 1
                        """,
                (rs, i) -> new CheckinTimelineBucket(rs.getTimestamp("bucket").toInstant(),
                        rs.getLong("accepted"), rs.getLong("duplicate"), rs.getLong("rejected")),
                seconds, seconds, eventId);
    }
}
