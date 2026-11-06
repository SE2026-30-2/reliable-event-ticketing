$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path "$PSScriptRoot/../../..").Path
Push-Location "$projectRoot/backend/ticketing-platform"
try {
    $zones = @('UTC','Asia/Ho_Chi_Minh','America/New_York')
    for ($i=0; $i -lt $zones.Count; $i++) {
        $seed = 4701 + $i
        $arguments = @('-B','-ntp','-Dtest=CheckinExport*Test',
            '-Djunit.jupiter.testmethod.order.default=org.junit.jupiter.api.MethodOrderer$Random',
            "-Djunit.jupiter.execution.order.random.seed=$seed", "-DargLine=-Duser.timezone=$($zones[$i])",'test')
        $ErrorActionPreference = 'Continue' # Windows PowerShell treats native stderr warnings as errors.
        & rtk proxy .\mvnw.cmd @arguments *> "$PSScriptRoot/evidence/flaky-$seed.log"
        $ErrorActionPreference = 'Stop'
        if ($LASTEXITCODE -ne 0) { throw "Flake check failed: seed=$seed timezone=$($zones[$i])" }
        Write-Output "PASS seed=$seed timezone=$($zones[$i])"
    }
} finally { Pop-Location }
