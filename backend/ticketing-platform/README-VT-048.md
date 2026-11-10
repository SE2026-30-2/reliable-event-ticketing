# VT-048 payment retry slice

This slice covers VNPay status queries, pending-only settlement, and the local 60-task harness. It uses JDK 21 and local fake VNPay/repository/outbox components; it does not call VNPay. Set `JAVA_HOME` to a JDK 21 installation and put its `bin` directory first on `PATH`.

From `backend/ticketing-platform`:

```powershell
.\mvnw.cmd -s ..\..\output\evidence\vt-048\maven-central-settings.xml -B -ntp "-Dtest=OnlinePaymentApplicationServiceTest,VnpayGatewayTest,VnpayQueryRetryPropertyTest,PaymentRequestSettlementRepositoryTest,VnpaySyncLoadHarnessTest,PaymentControllerTest" test
.\mvnw.cmd -s ..\..\output\evidence\vt-048\maven-central-settings.xml -B -ntp verify
```

The temporary Maven settings file switches an unavailable configured mirror to Maven Central and contains no credentials. The jqwik property exhaustively covers 0 to 3 transient HTTP 503 failures with seed `48048`. The H2 test checks the pending-only database update. Run the 60-task harness alone with:

```powershell
.\mvnw.cmd -s ..\..\output\evidence\vt-048\maven-central-settings.xml -B -ntp "-Dtest=VnpaySyncLoadHarnessTest" test
```

`VnpayPaymentFlowIT` requires Docker and a real PostgreSQL/Kafka test stack; it was not run in the local environment.
