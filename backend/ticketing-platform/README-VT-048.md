# VT-048 payment retry slice

This slice covers VNPay status queries, pending-only settlement, and the local 60-task harness. It uses JDK 21 and local fake VNPay/repository/outbox components; it does not call VNPay.

From `backend/ticketing-platform`:

```powershell
.\mvnw.cmd -B -ntp "-Dtest=OnlinePaymentApplicationServiceTest,VnpayGatewayTest,VnpayQueryRetryPropertyTest,PaymentRequestSettlementRepositoryTest,VnpaySyncLoadHarnessTest,PaymentControllerTest" test
.\mvnw.cmd -B -ntp verify
```

The jqwik property exhaustively covers 0–3 transient HTTP 503 failures with seed `48048`. The H2 test checks the pending-only database update. Run the 60-task harness alone with:

```powershell
.\mvnw.cmd -B -ntp "-Dtest=VnpaySyncLoadHarnessTest" test
```

`VnpayPaymentFlowIT` requires Docker and a real PostgreSQL/Kafka test stack; it was not run in the local environment.
