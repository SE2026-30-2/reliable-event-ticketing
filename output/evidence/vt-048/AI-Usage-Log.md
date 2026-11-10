# AI Usage Log — VT-048

## Tools and context boundary

- Coding agent: Codex subagent `payment_plan`, used first for a plan and then for a narrowly scoped implementation.
- Planning and implementation context was limited to `backend/ticketing-platform/src/main/java/com/ticketing/payment`, `backend/ticketing-platform/src/test/java/com/ticketing/payment`, and `backend/ticketing-platform/pom.xml`. The agent was explicitly told not to inspect other modules or repository documentation.
- Repository review, shared-contract review, test execution, mutation, load measurement, and this report were performed by the primary agent. The requested AI context boundary applied to the coding agent; no other service source was supplied to it.

## Planning prompt

> Planning only; do not edit files or run tests. Inspect only these paths for context: backend/ticketing-platform/src/main/java/com/ticketing/payment, backend/ticketing-platform/src/test/java/com/ticketing/payment, and backend/ticketing-platform/pom.xml. Do not inspect other modules or repository-wide docs. Prepare a concise implementation plan for the existing VNPay sync/status-query vertical slice: retry only transient timeouts/connection failures/provider 5xx, at most 3 attempts within an overall 2-second budget, no retries for business/signature errors, no duplicate payment state transitions or outbox events, and persistence failures must not return success. jqwik test dependency is approved. Return assumptions, evidence from inspected payment-module files, exact planned file changes, tests, and questions/risks. Do not implement.

## Implementation prompt

> Implement the reviewed payment-module patch now. Context restriction remains: inspect/change only backend/ticketing-platform/src/main/java/com/ticketing/payment, backend/ticketing-platform/src/test/java/com/ticketing/payment, and backend/ticketing-platform/pom.xml. Do not inspect other modules or docs. Test-first evidence is already recorded: OnlinePaymentApplicationServiceTest.syncDoesNotReturnSuccessWhenSettlementPersistenceFails fails because no exception is raised after repository save throws; VnpayQueryRetryPropertyTest fails on first HTTP 503 at VnpayGateway.post(). Implement: retry VNPay querydr only, max 3 attempts with bounded total retry time under 2 seconds; retry HTTP 5xx and transport timeout/connection IO only, never retry refund, 4xx, malformed/unsigned/bad-signature response or VNPay business response codes. Preserve sync's existing pending result on query failure, but keep state settlement/persistence/outbox outside the provider-query catch so persistence/outbox failures propagate. Make settlement an atomic PENDING-only transition and publish events only if that transition updated one row; no schema/API changes. Jqwik 1.9.0 test dependency is already added. Keep current tests intact except necessary fixture adaptation. Do not run tests; report exact changed files and explain design. Return a concise diff summary.

Follow-up narrowed the query retry budget to 1.2 seconds (350 ms per request, 50 ms waits) to leave room for persistence/outbox work inside the 2-second `sync()` target. It also explicitly required timeout retry coverage, one-attempt assertions for nonretryable responses, and a catch only around `provider.query`.

## Output used and review changes

- Planned AI files: `VnpayGateway.java`, `OnlinePaymentApplicationService.java`, `PaymentRequestRepositoryPort.java`, `PaymentRequestRepositoryAdapter.java`, `SpringDataPaymentRequestJpaRepository.java`, `VnpayGatewayTest.java`, `OnlinePaymentApplicationServiceTest.java`, new `ProviderQueryException.java`, `VnpayQueryRetryPropertyTest.java`, and the approved jqwik test dependency in `pom.xml`.
- Used: query-only retry policy; typed provider query failure; pending-only conditional database update; outbox publish only after the update wins; settlement/persistence/outbox failures propagate; targeted unit and gateway tests.
- Revised after repository review: replaced the initial full 2-second provider-query budget with 1.2 seconds because the acceptance target measures the whole sync path. Evidence: the service method includes database settlement and outbox persistence in the same transaction.
- Revised after repository review: added an H2 `@DataJpaTest` for the actual conditional update. A mocked service test cannot prove a database compare-and-set. Evidence: the JPA entity has no `@Version`; the guard is the `WHERE status = 'PENDING'` update.
- Added after the payment-only agent work: a local 60-user concurrency harness, controller exception propagation test, API documentation clarification, and this README. These are scoped to the requested slice and make the delivery evidence reviewable.
- Additional files accepted after root review: `PaymentRequestSettlementRepositoryTest.java` exercises the real H2 update; `VnpaySyncLoadHarnessTest.java` measures the 60-task target; `PaymentControllerTest.java` checks the exception boundary; `PaymentController.java` and `docs/api/ticketing-platform.md` clarify IPN persistence behavior; `backend/ticketing-platform/README-VT-048.md` documents commands.
- Not accepted without checking: the standalone MockMvc test could not observe a mapped non-2xx HTTP response because the exception propagated from the test dispatcher. The final assertion states only what it demonstrates: the persistence exception escapes the controller. A container-level HTTP response test remains unproven.

## Evidence

- Test-first red: `red-persistence-failure.log` shows `syncDoesNotReturnSuccessWhenSettlementPersistenceFails` failed with “Expecting code to raise a throwable”; `red-vnpay-property.log` shows the property test stopped at HTTP 503 before retry support.
- Green: `green-focused-final.log` and `verify-final.log` show 34 focused tests and 187 service tests passing. `coverage-final.log` repeats the focused suite with JaCoCo.
- Mutation: temporary commit `9f09f116f7d907fbe78f5395c8ce0e7462791ff2` swallowed settlement persistence exceptions. `mutation-killed.log` shows the targeted failure test killed it. The temporary branch and commit are not in the submission branch; the feature branch was restored and the test passed again in `green-persistence-after-mutation.log`.
- Load: `verify-final.log`, `coverage-final.log`, and `load-repeat-3.log` record 60 concurrent tasks and p95 samples below the 2.0-second target.

## Two plausible outputs requiring skepticism

1. A broad retry helper around the shared VNPay `post()` path would also repeat refund requests. The code review checked call sites and the regression test asserts refund HTTP 503 makes exactly one request.
2. A mock-only “race” test can pass while the database still allows two terminal updates. The H2 repository test now exercises the actual pending-only update twice and checks that the second update loses.

## Risk from the restricted context

Because the coding agent saw only payment files, it could not assess the downstream Kafka consumers or independently confirm the cross-module meaning of payment events. In particular it could overstate “no duplicated side effect” as an end-to-end ticketing guarantee. The primary review confirmed the shared outbox port writes in the caller's database transaction, but Docker was unavailable, so PostgreSQL/Kafka consumer behavior was not exercised.
