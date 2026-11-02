package com.techie.microservices.ticketing.checkin.web.dto;

import com.techie.microservices.ticketing.checkin.domain.model.CheckinRecord;

import java.time.Instant;
import java.util.UUID;

public record CheckinResultResponse(UUID ticketId, String outcome, String detail, Instant serverReceivedAt, Integer entryNo,
                                    UUID idempotencyKey, String eventName, String holderName, String ticketTypeName,
                                    Instant firstCheckinAt) {
    public static CheckinResultResponse from(CheckinRecord record) {
        return new CheckinResultResponse(record.getTicketId(), record.getOutcome().name(), record.getDetail(), record.getServerReceivedAt(), record.getEntryNo(),
                record.getIdempotencyKey(), null, null, null, null);
    }
}
