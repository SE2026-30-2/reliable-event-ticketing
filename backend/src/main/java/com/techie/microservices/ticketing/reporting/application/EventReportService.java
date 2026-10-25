package com.techie.microservices.ticketing.reporting.application;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Read-only reporting straight off the shared database - the tables of catalog, payment and check-in are
 * in one Postgres, so one SQL query can join what would otherwise need three services. Money is the
 * payments' own amounts (what was actually collected/returned), never recomputed from prices.
 * Authorization (may this caller see this event?) is the controller's job.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EventReportService {

    private final JdbcTemplate jdbc;

    public record TicketTypeLine(UUID ticketTypeId, String name, long priceCents, int quota, int issued, int reserved,
                                 int remaining, long refunded, long voided, long guests, long checkedIn, long revenueCents) {
    }

    public record Totals(long ticketsIssued, long guestTickets, long refunded, long voided, long checkedIn, long noShow,
                         long collectedCents, long refundedCents, long netRevenueCents, long couponDiscountCents) {
    }

    public record EventReport(UUID eventId, String name, Instant generatedAt, List<TicketTypeLine> ticketTypes, Totals totals) {
    }

    public EventReport report(UUID eventId) {
        String name = jdbc.queryForObject("SELECT name FROM events WHERE event_id = ?", String.class, eventId);

        Map<UUID, Map<String, Long>> byType = new LinkedHashMap<>();
        jdbc.query("""
                SELECT ticket_type_id, status, source, count(*) AS n FROM tickets
                WHERE event_id = ? GROUP BY ticket_type_id, status, source
                """, rs -> {
            Map<String, Long> m = byType.computeIfAbsent(rs.getObject("ticket_type_id", UUID.class), k -> new LinkedHashMap<>());
            String key = rs.getString("status");
            m.merge(key, rs.getLong("n"), Long::sum);
            if ("GUEST".equals(rs.getString("source")) && "ISSUED".equals(key)) {
                m.merge("GUEST", rs.getLong("n"), Long::sum);
            }
        }, eventId);

        Map<UUID, Long> checkedInByType = new LinkedHashMap<>();
        jdbc.query("""
                SELECT t.ticket_type_id, count(DISTINCT c.ticket_id) AS n
                FROM checkin_records c JOIN tickets t ON t.ticket_id = c.ticket_id
                WHERE c.event_id = ? AND c.outcome = 'ACCEPTED' GROUP BY t.ticket_type_id
                """, rs -> {
            checkedInByType.put(rs.getObject("ticket_type_id", UUID.class), rs.getLong("n"));
        }, eventId);

        // Revenue per type: what the original purchases of that type actually paid (collected, not refunded).
        Map<UUID, Long> revenueByType = new LinkedHashMap<>();
        jdbc.query("""
                SELECT t.ticket_type_id, COALESCE(SUM(t.price_cents), 0) AS cents
                FROM tickets t JOIN payment_requests p ON p.reservation_id = t.reservation_id AND p.status = 'COMPLETED'
                WHERE t.event_id = ? AND t.source = 'PURCHASE' GROUP BY t.ticket_type_id
                """, rs -> {
            revenueByType.put(rs.getObject("ticket_type_id", UUID.class), rs.getLong("cents"));
        }, eventId);

        List<TicketTypeLine> lines = jdbc.query("""
                SELECT ticket_type_id, name, price_cents, quota, issued_count, reserved_count FROM ticket_types
                WHERE event_id = ? ORDER BY created_at
                """, (rs, i) -> {
            UUID id = rs.getObject("ticket_type_id", UUID.class);
            Map<String, Long> c = byType.getOrDefault(id, Map.of());
            int quota = rs.getInt("quota");
            int issued = rs.getInt("issued_count");
            int reserved = rs.getInt("reserved_count");
            return new TicketTypeLine(id, rs.getString("name"), rs.getLong("price_cents"), quota, issued, reserved,
                    Math.max(0, quota - issued - reserved), c.getOrDefault("REFUNDED", 0L), c.getOrDefault("VOID", 0L),
                    c.getOrDefault("GUEST", 0L), checkedInByType.getOrDefault(id, 0L), revenueByType.getOrDefault(id, 0L));
        }, eventId);

        long valid = lines.stream().mapToLong(l -> byType.getOrDefault(l.ticketTypeId(), Map.of()).getOrDefault("ISSUED", 0L)).sum();
        long checkedIn = lines.stream().mapToLong(TicketTypeLine::checkedIn).sum();

        long[] money = jdbc.queryForObject("""
                SELECT COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.amount_cents END), 0),
                       COALESCE(SUM(CASE WHEN p.status = 'REFUNDED' THEN p.amount_cents END), 0)
                FROM payment_requests p
                WHERE p.reservation_id IN (SELECT DISTINCT reservation_id FROM tickets WHERE event_id = ? AND reservation_id IS NOT NULL)
                """, (rs, i) -> new long[]{rs.getLong(1), rs.getLong(2)}, eventId);
        long discount = jdbc.queryForObject("""
                SELECT COALESCE(SUM(tt.price_cents - t.price_cents), 0)
                FROM tickets t JOIN ticket_types tt ON tt.ticket_type_id = t.ticket_type_id
                JOIN payment_requests p ON p.reservation_id = t.reservation_id AND p.status = 'COMPLETED'
                WHERE t.event_id = ? AND t.source = 'PURCHASE' AND t.coupon_id IS NOT NULL
                """, Long.class, eventId);

        Totals totals = new Totals(
                lines.stream().mapToLong(l -> l.issued()).sum(),
                lines.stream().mapToLong(TicketTypeLine::guests).sum(),
                lines.stream().mapToLong(TicketTypeLine::refunded).sum(),
                lines.stream().mapToLong(TicketTypeLine::voided).sum(),
                checkedIn,
                Math.max(0, valid - checkedIn),
                money[0] + money[1], money[1], money[0], discount);
        return new EventReport(eventId, name, Instant.now(), new ArrayList<>(lines), totals);
    }

    /** One row per ticket that ever became real (issued, then possibly transferred/voided/refunded). */
    public void writeAttendeesCsv(UUID eventId, Writer out) {
        try {
            CsvWriter csv = new CsvWriter(out);
            csv.row(List.of("ticket_id", "ticket_type", "holder_name", "holder_email", "account_email", "status", "source",
                    "price_cents", "issued_at", "entries_used", "first_check_in_at"));
            jdbc.query("""
                    SELECT t.ticket_id, tt.name AS ticket_type, t.holder_name, t.holder_email, t.owner_email, t.status, t.source,
                           t.price_cents, t.issued_at, COALESCE(c.entries, 0) AS entries, c.first_at
                    FROM tickets t JOIN ticket_types tt ON tt.ticket_type_id = t.ticket_type_id
                    LEFT JOIN (SELECT ticket_id, count(*) AS entries, min(server_received_at) AS first_at
                               FROM checkin_records WHERE event_id = ? AND outcome = 'ACCEPTED' GROUP BY ticket_id) c ON c.ticket_id = t.ticket_id
                    WHERE t.event_id = ? AND t.status IN ('ISSUED', 'TRANSFERRED', 'VOID', 'REFUNDED')
                    ORDER BY t.issued_at, t.id
                    """, rs -> {
                try {
                    csv.row(List.of(rs.getObject("ticket_id", UUID.class), nz(rs.getString("ticket_type")), nz(rs.getString("holder_name")),
                            nz(rs.getString("holder_email")), nz(rs.getString("owner_email")), rs.getString("status"), rs.getString("source"),
                            rs.getLong("price_cents"), instant(rs.getTimestamp("issued_at")), rs.getInt("entries"), instant(rs.getTimestamp("first_at"))));
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            }, eventId, eventId);
            out.flush();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** One row per payment touching this event's reservations. */
    public void writePaymentsCsv(UUID eventId, Writer out) {
        try {
            CsvWriter csv = new CsvWriter(out);
            csv.row(List.of("payment_id", "reservation_id", "buyer_email", "provider", "txn_ref", "status", "amount_cents",
                    "created_at", "completed_at", "refunded_at"));
            jdbc.query("""
                    SELECT p.payment_request_id, p.reservation_id, p.provider, p.txn_ref, p.status, p.amount_cents,
                           p.created_at, p.completed_at, p.refunded_at,
                           (SELECT t.owner_email FROM tickets t WHERE t.reservation_id = p.reservation_id AND t.source = 'PURCHASE' ORDER BY t.id LIMIT 1) AS buyer
                    FROM payment_requests p
                    WHERE p.reservation_id IN (SELECT DISTINCT reservation_id FROM tickets WHERE event_id = ? AND reservation_id IS NOT NULL)
                    ORDER BY p.created_at
                    """, rs -> {
                try {
                    csv.row(List.of(rs.getObject("payment_request_id", UUID.class), rs.getObject("reservation_id", UUID.class), nz(rs.getString("buyer")),
                            nz(rs.getString("provider")), nz(rs.getString("txn_ref")), rs.getString("status"), rs.getLong("amount_cents"),
                            instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("completed_at")), instant(rs.getTimestamp("refunded_at"))));
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            }, eventId);
            out.flush();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String instant(Timestamp t) {
        return t == null ? "" : t.toInstant().toString();
    }
}
