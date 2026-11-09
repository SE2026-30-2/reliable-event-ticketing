# BT3 - Chu Duc Hai - 23001868 - VT-050

Baseline: c0a8f531334d449bd3d3c1c67e1484465a92814e
Branch: assignment/bt3-23001868-vt050
Scope: concurrent retries of the same QR check-in request.

## Run from repository root
Requires Python 3 and Java 17+ with the compiler module. Full backend requires Java 21.

```bash
python3 docs/individual/23001868-vt050/run.py
python3 docs/individual/23001868-vt050/run.py reverse
python3 docs/individual/23001868-vt050/run.py load
```

Expected after patch: 16 passing tests. Before patch: C01 fails on a unique idempotency_key conflict. Harness reads actual service source; repository, QR and framework are doubles. It does not prove Spring/PostgreSQL/API correctness or production p95.

PLAN.md records the plan and repository review. AI_TEST_REVIEW.md records two weak test decisions. evidence/ stores red, green, mutant, restored, repeated runs and 80-task raw latency samples. Do not merge before group review.
