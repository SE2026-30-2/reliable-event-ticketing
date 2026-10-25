package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

import com.techie.microservices.ticketing.TestcontainersConfiguration;
import com.techie.microservices.ticketing.checkin.application.port.AcceptResult;
import com.techie.microservices.ticketing.checkin.application.port.CheckinRecordRepositoryPort;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinOutcome;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinRecord;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the actual anti-replay mechanism against a real Postgres (Testcontainers) instead of
 * mocks: several concurrent "devices" submit an ACCEPTED attempt for the SAME ticket at the same
 * instant - exactly one must win, and the DB's partial unique index must be what decides that, not
 * any in-memory check (there is none - see {@code CheckinRecordRepositoryAdapter.tryInsertAccepted}).
 * This is the single highest-value test for the "chống dùng lại vé" requirement; a pure-Mockito
 * unit test cannot exercise this, since the guarantee IS the database constraint.
 * <p>
 * Not wired into the default {@code mvn test} run (needs Docker) - matches this codebase's
 * existing convention of keeping Testcontainers-based tests out of the default CI-safe path (see
 * {@code TestcontainersConfiguration}'s own doc, otherwise used only by the manual
 * {@code TestTicketingPlatformApplication} dev runner). Run on demand:
 * {@code mvn test -Dtest=CheckinRecordConcurrencyIT}.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class CheckinRecordConcurrencyIT {

    @Autowired
    private CheckinRecordRepositoryPort checkinRecordRepositoryPort;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private long concurrentAccepts(UUID ticketId, int attempts, int maxEntries) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(attempts);
        CountDownLatch startGate = new CountDownLatch(1);
        List<Future<AcceptResult>> futures = IntStream.range(0, attempts)
                .mapToObj(i -> pool.<AcceptResult>submit(() -> {
                    startGate.await();
                    CheckinRecord record = CheckinRecord.builder()
                            .ticketId(ticketId)
                            .idempotencyKey(UUID.randomUUID())
                            .serverReceivedAt(Instant.now())
                            .outcome(CheckinOutcome.ACCEPTED)
                            .detail("concurrent attempt " + i)
                            .createdAt(Instant.now())
                            .build();
                    return checkinRecordRepositoryPort.tryAccept(record, maxEntries);
                }))
                .collect(Collectors.toList());
        startGate.countDown();
        long accepted = 0;
        for (Future<AcceptResult> f : futures) {
            if (f.get(20, TimeUnit.SECONDS) == AcceptResult.ACCEPTED) {
                accepted++;
            }
        }
        pool.shutdown();
        return accepted;
    }

    @Test
    void exactlyOneConcurrentAcceptWinsForTheSameSingleUseTicket() throws Exception {
        assertThat(concurrentAccepts(UUID.randomUUID(), 8, 1)).isEqualTo(1);
    }

    @Test
    void aMultiEntryTicketAdmitsExactlyItsEntriesNoMoreUnderConcurrency() throws Exception {
        UUID ticketId = UUID.randomUUID();
        assertThat(concurrentAccepts(ticketId, 10, 3)).isEqualTo(3);
        // numbered 1..3 with no gaps or repeats
        assertThat(jdbc.queryForList("SELECT entry_no FROM checkin_records WHERE ticket_id = ? AND outcome = 'ACCEPTED' ORDER BY entry_no",
                Integer.class, ticketId)).containsExactly(1, 2, 3);
    }

    @Test
    void aVoidedTicketIsNeverAcceptedEvenIfTheCallerLookedBeforeItWasVoided() {
        UUID ticketId = UUID.randomUUID();
        jdbc.update("INSERT INTO voided_tickets (ticket_id, reason, voided_at) VALUES (?, 'test', now())", ticketId);
        CheckinRecord record = CheckinRecord.builder().ticketId(ticketId).idempotencyKey(UUID.randomUUID())
                .serverReceivedAt(Instant.now()).outcome(CheckinOutcome.ACCEPTED).createdAt(Instant.now()).build();
        assertThat(checkinRecordRepositoryPort.tryAccept(record, 1)).isEqualTo(AcceptResult.VOIDED);
    }
}
