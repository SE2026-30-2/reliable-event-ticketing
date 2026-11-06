package com.ticketing.reporting.application;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Executes production SQL and CSV code on H2; not evidence of PostgreSQL parity. */
class CheckinExportContractTest {
    JdbcTemplate jdbc;
    EventReportService service;
    final UUID event = new UUID(0, 1);
    @BeforeEach void setup() {
        JdbcDataSource ds = new JdbcDataSource();
        ds.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        jdbc = new JdbcTemplate(ds);
        jdbc.execute("CREATE TABLE checkin_records (id BIGINT PRIMARY KEY, event_id UUID, ticket_id UUID, device_id UUID, outcome VARCHAR(30) NOT NULL, server_received_at TIMESTAMP WITH TIME ZONE NOT NULL)");
        service = new EventReportService(jdbc);
    }
    void row(long id, UUID e, UUID ticket, String outcome) {
        jdbc.update("INSERT INTO checkin_records VALUES (?, ?, ?, NULL, ?, TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+00')", id, e, ticket, outcome);
    }
    String export(UUID e) {
        StringWriter out = new StringWriter();
        service.writeCheckinsCsv(e, out);
        return out.toString();
    }
    @Test void T09_emptyEventHasOnlyHeader() {
        assertThat(export(event)).isEqualTo("\uFEFFid,ticket_id,device_id,outcome,server_received_at\r\n");
    }
    @Test void T10_nullableFieldsOrderingAndScopeUseRealSql() {
        row(3,event,event,"ACCEPTED"); row(1,event,null,"INVALID_QR");
        row(2,new UUID(0,2),new UUID(0,2),"DUPLICATE"); row(4,null,null,"INVALID_QR");
        assertThat(export(event).lines().toList()).containsExactly(
                "\uFEFFid,ticket_id,device_id,outcome,server_received_at",
                "1,,,INVALID_QR,2026-01-01T00:00:00Z",
                "3,"+event+",,ACCEPTED,2026-01-01T00:00:00Z");
    }
    @Test void T11_sequentialRetryStableAndReadOnly() {
        row(1,event,event,"ACCEPTED");
        String first = export(event);
        assertThat(export(event)).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM checkin_records",Integer.class)).isEqualTo(1);
    }
    /** Latches establish actual overlap; no sleeps, timing luck, or unordered future assertions. */
    @Test void T12_overlappingSameEventRejectedThenRetrySucceeds() throws Exception {
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        Future<?> first = pool.submit(() -> service.writeCheckinsCsv(event, blockedWriter(entered,release)));
        try {
            assertThat(entered.await(5,TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> export(event)).isInstanceOf(EventReportService.ExportBusyException.class);
        } finally {
            release.countDown();
            try { first.get(5,TimeUnit.SECONDS); } finally { pool.shutdownNow(); }
        }
        assertThat(export(event)).contains("server_received_at");
    }
    @Test void T13_writerFailureReleasesGuard() {
        Writer broken = new Writer() {
            public void write(char[] c,int o,int n) throws IOException { throw new IOException("fixture sink failure"); }
            public void flush() {} public void close() {}
        };
        assertThatThrownBy(() -> service.writeCheckinsCsv(event,broken)).isInstanceOf(UncheckedIOException.class);
        assertThat(export(event)).contains("server_received_at");
    }
    @Test void T14_sqlFailureReleasesGuardAndRecoveryWorks() {
        jdbc.execute("ALTER TABLE checkin_records RENAME COLUMN outcome TO broken_outcome");
        assertThatThrownBy(() -> export(event)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        jdbc.execute("ALTER TABLE checkin_records RENAME COLUMN broken_outcome TO outcome");
        assertThat(export(event)).contains("server_received_at");
    }
    @Test void T15_otherEventNotBlocked() throws Exception {
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        Future<?> first = pool.submit(() -> service.writeCheckinsCsv(event,blockedWriter(entered,release)));
        try {
            assertThat(entered.await(5,TimeUnit.SECONDS)).isTrue();
            assertThat(export(new UUID(0,2))).contains("server_received_at");
        } finally {
            release.countDown();
            try { first.get(5,TimeUnit.SECONDS); } finally { pool.shutdownNow(); }
        }
    }
    static Writer blockedWriter(CountDownLatch entered, CountDownLatch release) {
        return new Writer() {
            boolean waited;
            public void write(char[] c,int o,int n) throws IOException {
                if (!waited) {
                    waited = true; entered.countDown();
                    try { if (!release.await(10,TimeUnit.SECONDS)) throw new IOException("gate timeout"); }
                    catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IOException(e); }
                }
            }
            public void flush() {} public void close() {}
        };
    }
    @Test @EnabledIfSystemProperty(named="vt047.load",matches="true")
    void T16_load120ConcurrentTasks() throws Exception {
        int workers=120, rows=50, rounds=3;
        for (int i=1;i<=workers;i++) for(int j=0;j<rows;j++) row(i*1000L+j,new UUID(0,i),new UUID(0,i),"ACCEPTED");
        // Warm-up one query/JIT path; excluded from measured samples.
        export(event);
        List<Double> samples=new ArrayList<>();
        for(int round=0;round<rounds;round++) {
            ExecutorService pool=Executors.newFixedThreadPool(workers);
            CountDownLatch ready=new CountDownLatch(workers), start=new CountDownLatch(1);
            long[] epoch=new long[1];
            List<Future<Double>> futures=new ArrayList<>();
            try {
                for(int i=1;i<=workers;i++) {
                    UUID e=new UUID(0,i);
                    futures.add(pool.submit(() -> {
                        ready.countDown();
                        if(!start.await(20,TimeUnit.SECONDS)) throw new IllegalStateException("start timeout");
                        String csv=export(e);
                        assertThat(csv.lines().count()).isEqualTo(rows+1);
                        assertThat(csv.lines().skip(1).allMatch(line -> line.contains(","+e+","))).isTrue();
                        return (System.nanoTime()-epoch[0])/1_000_000.0;
                    }));
                }
                assertThat(ready.await(20,TimeUnit.SECONDS)).isTrue();
                epoch[0]=System.nanoTime(); start.countDown();
                for(Future<Double> f:futures) samples.add(f.get(30,TimeUnit.SECONDS));
            } finally { start.countDown(); pool.shutdownNow(); }
        }
        Collections.sort(samples);
        double p95=samples.get((int)Math.ceil(samples.size()*0.95)-1);
        Path result=Path.of("target/vt047-load.json");
        Files.createDirectories(result.getParent());
        Files.writeString(result,"{\"workers\":120,\"rounds\":3,\"rowsPerEvent\":50,\"samples\":360,\"errors\":0,\"p95ms\":"+p95+",\"maxMs\":"+samples.get(samples.size()-1)+",\"targetMs\":3500,\"scope\":\"in-process JDBC H2 service, not HTTP or PostgreSQL\",\"sortedMs\":"+samples+"}");
        System.out.println("VT047_LOAD p95_ms="+p95+" samples="+samples.size()+" errors=0");
        assertThat(p95).isLessThanOrEqualTo(3500.0);
    }
}
