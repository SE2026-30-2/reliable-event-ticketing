# BT3 - 23001831 - VT-047

Vũ Quang Anh · SE2026-T12 · APP-07. AI assistance: Codex; see `plan.md` and
`ai-review.md`. Student must review code, reflection and declaration before submission.

Branch: https://github.com/SE2026-30-2/reliable-event-ticketing/tree/assignment/bt3-23001831-vt047

Baseline: `c6465af9722eddea6645181342e5b9fb059c845f`.
The assignment names Resilient-Order-Workflow (404); the user explicitly confirmed
this APP-07 repository on 2026-11-06. No assertion that both repositories are identical.

## Change

`GET /api/manage/events/{eventId}/checkins.csv` exports id, ticket_id, device_id,
outcome, server_received_at from the audit table. Existing management authorization
runs first. Only matching event_id rows appear, ordered by timestamp/id; NULL UUIDs
become empty cells. UTF-8/BOM, attachment filename and no-store are asserted.
One export per event per JVM while serialization runs; overlap returns 409. SQL
failures return 503 before a successful CSV response. No new dependencies.

## Run (Java 21; Maven wrapper)

From `backend/ticketing-platform` on Windows (`./mvnw` on Unix):

```powershell
.\mvnw.cmd -B -ntp '-Dtest=CheckinExport*Test,CsvWriterTest' '-Dvt047.load=true' test
.\mvnw.cmd -B -ntp org.jacoco:jacoco-maven-plugin:0.8.12:prepare-agent '-Dvt047.load=true' verify org.jacoco:jacoco-maven-plugin:0.8.12:report
```

Without `-Dvt047.load=true`, T16 is intentionally skipped. Default Maven tests do
not run existing `*IT` Testcontainers tests. Docker was unavailable in this run.
Do not equate verify success with PostgreSQL, Flyway or browser E2E verification.
Load output: `target/vt047-load.json`; coverage: `target/site/jacoco/index.html`.

## RED and mutation replay

- RED tests: `b8d107b`; pre-patch plan/RED evidence: `535abd2`.
- Implementation and contract/load tests: `770d708`.
- Mutant: `b15e9b2`, local branch `experiment/vt047-remove-export-guard` only.
- `evidence/mutation.patch` preserves the exact deliberate removal.

To replay RED, create a separate worktree at `535abd2` then run
`-Dtest=CheckinExportApiTest test`: four assertions must fail (missing endpoint).
To replay mutation, create a disposable worktree from the submission branch,
apply `docs/assignments/VT-047/evidence/mutation.patch`, then run:

```powershell
.\mvnw.cmd -B -ntp '-Dtest=CheckinExportContractTest#T12_overlappingSameEventRejectedThenRetrySucceeds' test
```

Expected: one assertion failure, "Expecting code to raise a throwable."
The unmutated branch must pass. Do not apply or merge the mutant into a deployment branch.

## Flaky checks

Run `docs/assignments/VT-047/check-flakes.ps1`: random method order with seeds
4701/4702/4703 and timezones UTC, Asia/Ho_Chi_Minh, America/New_York.
It uses the developer's existing `rtk` proxy; without RTK replace
`rtk proxy .\mvnw.cmd` in that script with `.\mvnw.cmd`.
API fixture resets a shared schema and expects default sequential JUnit methods.
Contract tests use isolated DB names. Latches/futures establish overlap without sleep.

## Evidence and traceability

| Requirement | Cases | Test file | Evidence |
|---|---|---|---|
| AC1 permission/ownership | T01-T07 | CheckinExportApiTest | red.log, green-confirmed.log, verify.log |
| AC2 event scope/null/order | T03,T05,T10 | API + Contract | green-confirmed.log, verify.log |
| AC3 CSV/empty | T03,T09 + CsvWriterTest | API + Contract + CSV | verify.log |
| AC4 overlap/retry/read-only | T11,T12,T15,T17 | Contract + API | mutation.log, mutation.patch, verify.log |
| AC5 failure/recovery | T08,T13,T14 | API + Contract | verify.log |
| NFR1 120 tasks p95<=3500ms | T16 | Contract | load.json |
| Flaky time/order risk | new functional cases | API + Contract | flaky-4701/4702/4703.log |

Tests live under `src/test/java/com/ticketing/reporting/{web,application}`.
`verify.log`: 193 tests, no failures/errors/skips, including load.
`green-confirmed.log`: original 21-test focused suite before adding T17.
Flaky runs: 17 tests each, 0 failures/errors, 1 intentional load skip each.
`jacoco.xml`: new method 10/10 lines and 2/2 guard branches; controller 12/12 lines;
row lambda 5/7 lines (Writer failure inside row callback not exercised).

Uninstrumented load: `load.json`; JaCoCo load: `load-instrumented.json`. Do not mix
these runs. 120 events × 50 records, 120 ready threads, 3 bursts, 360 samples;
nearest-rank p95 includes scheduling from the common start gate through CSV assertions.
This measures service/JDBC, not HTTP end-to-end.

## Limits and next test

H2 executes production SQL on a projected schema; it is not PostgreSQL/Flyway.
MockMvc runs real security/policy/controller/service, but JWT verification and
EventRepositoryPort lookup are doubles. No real login/browser/HTTP load was run.
E2E in the report is a plan, not counted as executed. Buffering is unbounded for
large events; guard is per JVM and protects generation, not later network transfer.
Next: PostgreSQL+Flyway HTTP tests with two organizers, realistic pool, large data
and multiple instances; decide row limit/pagination and distributed admission.

No merge or Classroom submission. Student/team review remains necessary.
