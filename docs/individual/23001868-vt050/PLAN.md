# VT-050 — AI plan before code
Baseline: c0a8f531334d449bd3d3c1c67e1484465a92814e
Branch: assignment/bt3-23001868-vt050

Prompt P1: Inspect the existing check-in retry flow. Propose a minimal test-first change so concurrent submissions of the SAME request return the committed result rather than a unique-key error. Preserve API/schema. Generate combinatorial tests, negative cases, deterministic race and > to >= boundary mutation; do not claim PostgreSQL correctness from mocks.

Initial AI proposals and repository review:
1. Add an idempotency key column and migration. REJECTED: CheckinRecordEntity already has unique idempotency_key; docs/database.md and docs/api/ticketing-platform.md document retry semantics. No migration needed.
2. Add @Transactional to the service and catch insert exceptions inside it. REJECTED: SubmitCheckinApplicationService explicitly avoids a surrounding transaction; CheckinRecordRepositoryAdapter.tryAccept is transactional. A failed insert must roll back before a separate read. Catch at the non-transactional service boundary instead.
3. Use sleep(100) to arrange races and Instant.now() for exact-boundary tests. REVISED: barrier forces all initial reads to miss; source harness virtualizes only Instant.now() to a fixed clock. No sleep or external network.
4. Existing replay test proves concurrent retries. REJECTED: it stubs an already-present row and never exercises conflicting writes.

Assumptions: identical request = same key and same payload/device. Key reuse with changed payload/device is outside this slice; existing replay authorization needs separate review. PostgreSQL READ COMMITTED, unique violations become Spring DataIntegrityViolationException, repository transaction ends before service recovery. No guarantee of real financial exactly-once delivery.

Files: service SubmitCheckinApplicationService.java (small recovery wrapper); docs/individual/23001868-vt050/{run.py,Harness.java,PLAN.md,README.md,evidence/*}. No DTO/schema/API changes.

Environment (rerun 10/11/2026, Asia/Bangkok): Java 17 runtime includes jdk.compiler; no javac executable, Java 21, Docker or project dependency cache. run.py falls back to java -m jdk.compiler/com.sun.tools.javac.Main. Only this Java-17-compatible service slice is compiled. Full Java 21 Maven/Spring/PostgreSQL verification is NOT claimed.

AI test review (retained from the earlier individual draft and verified again):
W1 generated: assert result != null on replay. REPLACED by same committed key/outcome/entryNo, exactly one row and one accepted entry across 80 callers (C01).
W2 generated: duplicate sequential replay case with a different UUID. DELETED in favor of forced overlapping initial misses and conflict recovery (C01), plus distinct-key control (C02).
These are AI-agent review decisions; they are NOT evidence of the student's personal review.


Harness review on rerun: QR call counter uses AtomicInteger to avoid an unused shared counter race. C01 does not assert internal database-generated record IDs: native tryAccept returns the accepted attempt without filling that ID, and public API contract uses idempotencyKey/outcome/entryNo. Assert one persisted row, one accepted entry, all 80 stable key/outcome/entryNo instead.
