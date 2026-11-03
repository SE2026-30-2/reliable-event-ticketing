package com.ticketing.reporting.application;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EventAnalyticsService {
    private final JdbcTemplate jdbc;
    public record Day(String date, long ticketsSold, long revenueCents) {}
    public record Analytics(long views, String timezone, List<Day> daily) {}

    @Transactional
    public void recordView(UUID eventId) {
        // A management page or an unpublished event never increments this public metric.
        jdbc.update("""
            INSERT INTO event_views(event_id, view_count)
            SELECT event_id, 1 FROM events WHERE event_id = ? AND status = 'PUBLISHED'
            ON CONFLICT(event_id) DO UPDATE SET view_count = event_views.view_count + 1
            """, eventId);
    }

    @Transactional(readOnly = true)
    public Analytics analytics(UUID eventId, int days, String timezone) {
        if (!List.of(7, 30, 90).contains(days)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "days must be 7, 30 or 90");
        ZoneId zone;
        try { zone = ZoneId.of(timezone); }
        catch (DateTimeException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid timezone"); }
        LocalDate first = LocalDate.now(zone).minusDays(days - 1);
        Instant from = first.atStartOfDay(zone).toInstant(), until = first.plusDays(days).atStartOfDay(zone).toInstant();
        Map<String, Day> rows = new LinkedHashMap<>();
        for (int i = 0; i < days; i++) { String date = first.plusDays(i).toString(); rows.put(date, new Day(date, 0, 0)); }
        // Each payment occurs once. A bundle counts its purchased tickets; transferred copies do not inflate sales.
        jdbc.query("""
            SELECT to_char(p.completed_at AT TIME ZONE ?, 'YYYY-MM-DD') AS day,
                   SUM(p.amount_cents) AS revenue,
                   SUM((SELECT count(*) FROM tickets t WHERE t.reservation_id = p.reservation_id AND t.source = 'PURCHASE')) AS sold
            FROM payment_requests p
            WHERE p.status = 'COMPLETED' AND p.completed_at >= ? AND p.completed_at < ?
              AND EXISTS(SELECT 1 FROM tickets t WHERE t.reservation_id = p.reservation_id AND t.event_id = ?)
            GROUP BY 1 ORDER BY 1
            """, rs -> { String day = rs.getString("day"); rows.put(day, new Day(day, rs.getLong("sold"), rs.getLong("revenue"))); },
                timezone, Timestamp.from(from), Timestamp.from(until), eventId);
        Long views = jdbc.queryForObject("SELECT COALESCE((SELECT view_count FROM event_views WHERE event_id = ?), 0)", Long.class, eventId);
        return new Analytics(views, timezone, new ArrayList<>(rows.values()));
    }
}
