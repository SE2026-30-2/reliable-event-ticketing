# BT3 VT-051

## Chay test

Tu `backend/ticketing-platform` trong PowerShell:

```powershell
.\mvnw.cmd -B -ntp "-Dtest=ManagementEndpointsSecurityTest,SubmitCheckinApplicationServiceTest" test
```

Integration/concurrency test dung PostgreSQL 16 qua Testcontainers, can Docker daemon:

```powershell
.\mvnw.cmd -B -ntp "-Dtest=CheckinRecordConcurrencyIT" test
```

Test `twoHundredConcurrentAttemptsPreserveTheOneWinnerInvariant` mo 200 worker, cung tranh mot ticket single-entry; ky vong dung mot request duoc chap nhan. P95 duoc in ra log de so sanh voi muc 5.0 giay, nhung day la database harness, khong phai HTTP load test.

Report nguon va PDF: `BT3_23001881_VT-051.html` va `BT3_23001881_VT-051.pdf`.

## Trang thai nop

Branch local: `assignment/BT3-23001881-VT-051`. Baseline: `aa5ea7d8ef8da4e0472b7327c81e612b64337103`. Chua push GitHub va chua tao PR; khong co remote link de bao cao. Cac thay doi hien tai la characterization tests va harness, khong trien khai reviewer approval workflow.

Test commit: `4d189a7` (`test: characterize reviewer and concurrent check-in risks`).
