# VT-047: plan before implementation

Baseline: c6465af9722eddea6645181342e5b9fb059c845f. Student: Vu Quang Anh, 23001831.
User confirmed repository SE2026-30-2/reliable-event-ticketing on 2026-11-06.

## Prompt to coding agent (Codex)
Implement a small event-scoped check-in CSV export. First add executable tests that
fail on the baseline because the route does not exist. Reuse real security rules,
CsvWriter and JDBC. Test unauthorized access, cross-event isolation, null fields,
SQL failures and concurrent exports. Do not add dependencies or modify migrations.
Run tests, review the patch, remove the concurrency guard in a temporary commit,
prove a test detects it, restore it, and measure 120 simultaneous tasks.

## Initial proposals and repository review
1. Add a new attendees CSV endpoint. REJECTED: ReportController already provides
   attendees.csv and payments.csv; docs/api/ticketing-platform.md documents both.
   Change to checkins.csv, an additive export of the existing audit table.
2. Mock JdbcTemplate and declare database integration verified. REJECTED:
   V4__add_checkin.sql allows NULL ticket_id/device_id; mocks cannot establish SQL
   column/type/null behavior. Use an actual H2 database (existing test dependency)
   and explicitly reserve PostgreSQL migration/driver claims for a later run.
3. Return 403 for every organizer denied access. CORRECTED: actual
   EventAccessApplicationService conceals foreign/missing events with 404.
4. Streaming after HTTP 200 is safe on DB failure. CORRECTED: buffer this small
   slice before returning 200; return 503 on DataAccessException, no CSV body.

## Scope and assumptions
- GET /api/manage/events/{eventId}/checkins.csv, same role/ownership gate as reports.
- Every row belongs to the requested event, all outcomes, deterministic timestamp/id order.
- CSV columns: id,ticket_id,device_id,outcome,server_received_at; no detail/PII.
- At most one export per event per JVM while serialization is active; overlap 409.
  Sequential retry is allowed; this is a concurrency guard, not a durable job cache.
- Small bounded assignment dataset; buffering and one-JVM guard are explicit limits.
- Docker daemon unavailable; H2 validates the executed SQL subset, not PostgreSQL parity.

## Planned files and sequence
1. src/test/java/com/ticketing/reporting/web/CheckinExportApiTest.java: RED HTTP tests.
2. EventReportService.java + ReportController.java: small implementation, GREEN tests.
3. reporting/application/CheckinExportContractTest.java: real SQL, deterministic
   concurrency, failure/retry, 120-worker load harness; existing CsvWriterTest reused.
4. docs/api/ticketing-platform.md and docs/assignments/VT-047/: API, README, logs,
   review and traceability. No identity/frontend/mobile/database contract changes.
5. Temporary mutation commit on a separate branch, then restore clean submission branch.
6. Full Maven verify; report actual executed scope and any blockers. No merge.
