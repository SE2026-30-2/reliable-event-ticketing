package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

import com.techie.microservices.ticketing.shared.application.port.TicketUsagePort;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TicketUsageAdapter implements TicketUsagePort {

    private final JdbcTemplate jdbc;

    /** MANDATORY: the lock only protects anything if it lives as long as the caller's transaction. */
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean voidIfUnused(UUID ticketId, String reason) {
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", ps -> ps.setString(1, ticketId.toString()), rs -> null);
        Boolean used = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM checkin_records WHERE ticket_id = ? AND outcome = 'ACCEPTED')", Boolean.class, ticketId);
        if (Boolean.TRUE.equals(used)) {
            return false;
        }
        jdbc.update("""
                INSERT INTO voided_tickets (ticket_id, reason, voided_at) VALUES (?, ?, ?)
                ON CONFLICT (ticket_id) DO NOTHING
                """, ticketId, reason, Timestamp.from(Instant.now()));
        return true;
    }
}
