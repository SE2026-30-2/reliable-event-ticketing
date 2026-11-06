# AI review after test execution (2026-11-06)

Prompt: Review the small patch after 21/21 focused tests passed. Challenge scope,
authorization, SQL contract, concurrent calls and claims not justified by evidence.

Finding A (supported; accepted in this draft): The guard must be released for SQL
and writer exceptions, otherwise one failure permanently blocks future exports.
Evidence: the diff uses finally; T13 and T14 fail a real sink/schema, then rerun
successfully. T12 establishes overlap with latches. No repair required.

Finding B (insufficient evidence; rejected): "The H2 integration tests establish
that PostgreSQL production exports satisfy p95 <=3.5 seconds."
Reason: actual H2 SQL is better evidence than a mocked JdbcTemplate, but the
fixture is a projected schema, not Flyway on PostgreSQL. No HTTP server, real
JWT verification, PostgreSQL pool, proxy or multiple JVMs are included in load.
The statement is a deliberately challenged review claim, not an established result.

Finding C (supported residual risk): the StringWriter buffer grows with the event
history and the guard is process-local. The slice is suitable for the tested small
dataset; pagination/row cap, database-backed admission and HTTP load are needed
before claiming large-event or multi-instance readiness. Do not merge automatically.

Two plausible AI tests not trusted immediately:
- A 404-only negative test also passes when the endpoint is absent (T04/T06 on RED).
  Keep positive CSV/body/header checks T03/T05 and inspect the RED failure reason.
- Mocking JDBC rows (or pretending the projected H2 fixture is full production
  schema) misses column/type/nullable and migration constraints. T08/T10/T14 execute
  SQL; PostgreSQL/Flyway remains explicitly unverified.

This is AI-authored analysis for the student's review, not evidence that a human
has already reviewed or approved the patch or made the submission declaration.
