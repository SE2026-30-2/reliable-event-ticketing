package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

import com.techie.microservices.ticketing.checkin.application.port.AcceptResult;
import com.techie.microservices.ticketing.checkin.application.port.CheckinRecordRepositoryPort;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinOutcome;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CheckinRecordRepositoryAdapter implements CheckinRecordRepositoryPort {

    private final SpringDataCheckinRecordJpaRepository jpaRepository;
    private final JdbcTemplate jdbc;

    @Override
    public Optional<CheckinRecord> findByIdempotencyKey(UUID idempotencyKey) {
        return jpaRepository.findByIdempotencyKey(idempotencyKey).map(CheckinRecordRepositoryAdapter::toDomain);
    }

    @Override
    public CheckinRecord save(CheckinRecord record) {
        return toDomain(jpaRepository.save(toEntity(record)));
    }

    /**
     * Native SQL on purpose: a plain JPA {@code save()} whose flush violates the unique index marks
     * the whole transaction rollback-only even if the exception is caught (confirmed by
     * {@code CheckinRecordConcurrencyIT}), so the insert is {@code ON CONFLICT DO NOTHING} and the
     * row count says whether it landed. The per-ticket advisory lock makes the count-then-insert
     * sequence atomic against other scans, voids and transfers of the same ticket.
     */
    @Override
    @Transactional
    public AcceptResult tryAccept(CheckinRecord record, int maxEntries) {
        UUID ticketId = record.getTicketId();
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", ps -> ps.setString(1, ticketId.toString()), rs -> null);

        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM voided_tickets WHERE ticket_id = ?)", Boolean.class, ticketId))) {
            return AcceptResult.VOIDED;
        }
        Integer used = jdbc.queryForObject("SELECT count(*) FROM checkin_records WHERE ticket_id = ? AND outcome = 'ACCEPTED'", Integer.class, ticketId);
        int next = (used == null ? 0 : used) + 1;
        if (next > Math.max(1, maxEntries)) {
            return AcceptResult.ALL_ENTRIES_USED;
        }
        int inserted = jdbc.update("""
                        INSERT INTO checkin_records
                            (ticket_id, event_id, device_id, idempotency_key, client_checkin_at, server_received_at, outcome, detail, created_at, entry_no)
                        VALUES (?, ?, ?, ?, ?, ?, 'ACCEPTED', ?, ?, ?)
                        ON CONFLICT (ticket_id, entry_no) WHERE outcome = 'ACCEPTED' DO NOTHING
                        """,
                ticketId, record.getEventId(), record.getDeviceId(), record.getIdempotencyKey(),
                ts(record.getClientCheckinAt()), ts(record.getServerReceivedAt()), record.getDetail(), ts(record.getCreatedAt()), next);
        if (inserted == 1) {
            record.setEntryNo(next);
            return AcceptResult.ACCEPTED;
        }
        return AcceptResult.ALL_ENTRIES_USED; // unreachable under the lock; the index said someone else got there first
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    @Override
    public long countByEventIdAndOutcome(UUID eventId, CheckinOutcome outcome) {
        return jpaRepository.countByEventIdAndOutcome(eventId, outcome.name());
    }

    private static CheckinRecordEntity toEntity(CheckinRecord record) {
        return CheckinRecordEntity.builder()
                .id(record.getId())
                .ticketId(record.getTicketId())
                .eventId(record.getEventId())
                .deviceId(record.getDeviceId())
                .idempotencyKey(record.getIdempotencyKey())
                .clientCheckinAt(record.getClientCheckinAt())
                .serverReceivedAt(record.getServerReceivedAt())
                .outcome(record.getOutcome().name())
                .detail(record.getDetail())
                .createdAt(record.getCreatedAt())
                .entryNo(record.getEntryNo())
                .build();
    }

    private static CheckinRecord toDomain(CheckinRecordEntity entity) {
        return CheckinRecord.builder()
                .id(entity.getId())
                .ticketId(entity.getTicketId())
                .eventId(entity.getEventId())
                .deviceId(entity.getDeviceId())
                .idempotencyKey(entity.getIdempotencyKey())
                .clientCheckinAt(entity.getClientCheckinAt())
                .serverReceivedAt(entity.getServerReceivedAt())
                .outcome(CheckinOutcome.valueOf(entity.getOutcome()))
                .detail(entity.getDetail())
                .createdAt(entity.getCreatedAt())
                .entryNo(entity.getEntryNo())
                .build();
    }
}
