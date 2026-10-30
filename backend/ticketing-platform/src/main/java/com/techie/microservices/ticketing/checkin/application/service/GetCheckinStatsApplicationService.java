package com.techie.microservices.ticketing.checkin.application.service;

import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.checkin.application.port.CheckinRecordRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.CheckinStats;
import com.techie.microservices.ticketing.checkin.application.port.GetCheckinStatsUseCase;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinOutcome;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Reads straight off {@code checkin_records} and catalog's {@code tickets} table - both live in
 * the same database now that this is one app, so there is no cross-service call here, just two
 * repositories. {@code totalIssued} reuses catalog's own {@link TicketRepositoryPort} rather than
 * checkin maintaining its own duplicate count of something catalog already owns.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetCheckinStatsApplicationService implements GetCheckinStatsUseCase {

    private final CheckinRecordRepositoryPort checkinRecordRepositoryPort;
    private final TicketRepositoryPort ticketRepositoryPort;

    @Override
    public CheckinStats getStats(UUID eventId) {
        long totalIssued = ticketRepositoryPort.countByEventIdAndStatus(eventId, TicketStatus.ISSUED);

        long accepted = checkinRecordRepositoryPort.countByEventIdAndOutcome(eventId, CheckinOutcome.ACCEPTED);
        long duplicate = checkinRecordRepositoryPort.countByEventIdAndOutcome(eventId, CheckinOutcome.DUPLICATE);
        long deviceRejected = checkinRecordRepositoryPort.countByEventIdAndOutcome(eventId, CheckinOutcome.DEVICE_NOT_FOUND)
                + checkinRecordRepositoryPort.countByEventIdAndOutcome(eventId, CheckinOutcome.DEVICE_REVOKED);
        long invalid = checkinRecordRepositoryPort.countByEventIdAndOutcome(eventId, CheckinOutcome.INVALID_SIGNATURE)
                + checkinRecordRepositoryPort.countByEventIdAndOutcome(eventId, CheckinOutcome.EXPIRED_WINDOW)
                + checkinRecordRepositoryPort.countByEventIdAndOutcome(eventId, CheckinOutcome.WRONG_EVENT)
                + checkinRecordRepositoryPort.countByEventIdAndOutcome(eventId, CheckinOutcome.TICKET_VOIDED);

        return new CheckinStats(eventId, totalIssued, accepted, duplicate, deviceRejected, invalid);
    }
}
