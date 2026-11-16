#!/usr/bin/env python3
"""Dependency-free HTTP load harness for the waitlist undo endpoint.

The cases file is local test data and must contain at least 150 records:
[{"entryId": "...", "token": "..."}, ...]. Use distinct owned WAITING entries for
the `unique` scenario or repeat one entry ID for the `contention` scenario. Never commit tokens.
"""

import argparse
import concurrent.futures
import json
import math
import threading
import time
import urllib.error
import urllib.request
from collections import Counter


def request(base_url, case, barrier):
    url = f"{base_url.rstrip('/')}/api/waitlist/{case['entryId']}/undo"
    request = urllib.request.Request(
        url,
        method="POST",
        headers={"Authorization": f"Bearer {case['token']}", "Accept": "application/json"},
    )
    barrier.wait()
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
            return response.status, time.perf_counter() - started
    except urllib.error.HTTPError as error:
        error.read()
        return error.code, time.perf_counter() - started
    except Exception:
        return 0, time.perf_counter() - started


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="Ticketing platform URL, e.g. http://localhost:8091")
    parser.add_argument("--cases", required=True, help="Local JSON file with entryId/token records")
    parser.add_argument("--scenario", choices=("unique", "contention"), required=True)
    args = parser.parse_args()

    with open(args.cases, encoding="utf-8") as source:
        cases = json.load(source)
    if len(cases) < 150:
        parser.error("provide at least 150 pre-seeded cases for the 150-user target")
    cases = cases[:150]
    barrier = threading.Barrier(150)
    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=150) as pool:
        results = list(pool.map(lambda item: request(args.base_url, item, barrier), cases))
    wall_seconds = time.perf_counter() - started

    statuses = Counter(status for status, _ in results)
    latencies = sorted(latency for _, latency in results)
    p95_seconds = latencies[math.ceil(0.95 * len(latencies)) - 1]
    expected = statuses[200] == 150 if args.scenario == "unique" else statuses[200] == 1 and statuses[409] == 149
    passed = expected and p95_seconds <= 4.0
    print(json.dumps({
        "scenario": args.scenario,
        "concurrent_users": len(results),
        "status_counts": dict(statuses),
        "wall_seconds": round(wall_seconds, 3),
        "p95_seconds": round(p95_seconds, 3),
        "p95_target_seconds": 4.0,
        "correct_outcome_counts": expected,
        "pass": passed,
    }, indent=2))
    raise SystemExit(0 if passed else 1)


if __name__ == "__main__":
    main()
