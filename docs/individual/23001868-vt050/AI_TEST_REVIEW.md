# AI-generated tests: review record (VT-050 only)

P1 (retained from the individual plan before production patch):
"Inspect the existing check-in retry flow. Propose a minimal test-first change so concurrent submissions of the SAME request return the committed result rather than a unique-key error. Preserve API/schema. Generate combinatorial tests, negative cases, deterministic race and > to >= boundary mutation; do not claim PostgreSQL correctness from mocks."

Two AI-generated draft cases reviewed and changed:

| Draft | Why weak | Decision and executable evidence |
| --- | --- | --- |
| W1: `assert submit(replayCommand) != null` | Passes for a newly created duplicate record or an incorrect DUPLICATE response. | Replace with R01 (same replay object, one write) and C01 (80 stable key/outcome/entryNo, exactly one row and accepted entry). |
| W2: duplicate of sequential replay with another UUID | Exercises the same branch; misses the read-miss/insert-conflict interleaving. | Delete from the accepted design. Use C01 forced 80 initial misses plus C02 80 distinct keys and F01 unrelated constraint propagation. |

These are unaccepted AI draft cases documented for comparison, not claims that the student ran or reviewed them personally. The first saved executable test commit already contains their stronger replacements. No test data/prompt/reflection from another group member was used.

Current rerun review:
- Changed the test double's shared QR call counter to AtomicInteger; concurrent cases do not assert its count.
- Removed a C01 assertion on the internal record ID. Real CheckinRecordRepositoryAdapter.tryAccept inserts through JDBC without populating the attempt's generated ID. Public replay semantics concern key/outcome/entryNo, not that internal return object's ID. The source, docs and acceptance criteria must agree.
- The in-memory repository simulates rollback/uniqueness visibility; real Spring transaction integration remains unproved.
- The mutant changes `now > validUntilEpochSeconds()` to `now >= validUntilEpochSeconds()` only in isolated commit 8055e41, not the submission branch.

All logs were executed by the agent. Student review and responsibility statement must be confirmed by the student before submission.
