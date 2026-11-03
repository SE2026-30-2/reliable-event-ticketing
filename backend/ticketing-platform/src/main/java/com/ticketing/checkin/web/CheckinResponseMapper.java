package com.ticketing.checkin.web;

import com.ticketing.checkin.domain.model.CheckinRecord;
import com.ticketing.checkin.domain.model.CheckinOutcome;
import com.ticketing.checkin.infrastructure.security.ApiKeyHasher;
import com.ticketing.checkin.web.dto.CheckinResultResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CheckinResponseMapper {
    private final JdbcTemplate jdbc;
    private final ApiKeyHasher hasher;

    public CheckinResultResponse response(CheckinRecord record, String deviceKey) {
        if (deviceKey == null || record.getTicketId() == null || record.getDeviceId() == null ||
                record.getOutcome() == CheckinOutcome.DEVICE_NOT_FOUND || record.getOutcome() == CheckinOutcome.DEVICE_REVOKED ||
                record.getOutcome() == CheckinOutcome.WRONG_EVENT || record.getOutcome() == CheckinOutcome.INVALID_SIGNATURE) {
            return CheckinResultResponse.from(record);
        }
        // A submitted key must match the original, still active device before disclosing holder information.
        return jdbc.query("""
            SELECT e.name AS event_name, t.holder_name, tt.name AS type_name,
                   (SELECT min(server_received_at) FROM checkin_records WHERE ticket_id = t.ticket_id AND outcome = 'ACCEPTED') AS first_at
            FROM tickets t JOIN events e ON e.event_id = t.event_id
            JOIN ticket_types tt ON tt.ticket_type_id = t.ticket_type_id
            JOIN checkin_devices d ON d.device_id = ? AND d.api_key_hash = ? AND d.status = 'ACTIVE'
                AND (d.event_id IS NULL OR d.event_id = t.event_id)
            WHERE t.ticket_id = ?
            """, (rs, i) -> new CheckinResultResponse(record.getTicketId(), record.getOutcome().name(), record.getDetail(),
                record.getServerReceivedAt(), record.getEntryNo(), record.getIdempotencyKey(), rs.getString("event_name"),
                rs.getString("holder_name"), rs.getString("type_name"), rs.getTimestamp("first_at") == null ? null : rs.getTimestamp("first_at").toInstant()),
                record.getDeviceId(), hasher.hash(deviceKey), record.getTicketId())
                .stream().findFirst().orElseGet(() -> CheckinResultResponse.from(record));
    }
}
