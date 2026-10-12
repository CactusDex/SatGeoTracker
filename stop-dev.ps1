param(
    [switch]$Quiet
)

$ErrorActionPreference = "SilentlyContinue"
$RunDir = Join-Path $PSScriptRoot ".run"

foreach ($name in @("backend", "frontend")) {
    $pidFile = Join-Path $RunDir "$name.pid"
    if (-not (Test-Path $pidFile)) {
        continue
    }

    $processId = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($processId -match "^\d+$") {
        if (-not $Quiet) {
            Write-Host "Stopping SGT $name (PID $processId)..."
        }

        # /T terminates the process tree (PowerShell + node/python child).
        & taskkill.exe /PID $processId /T /F *> $null
    }

    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

if ((Test-Path $RunDir) -and -not (Get-ChildItem $RunDir -Force)) {
    Remove-Item $RunDir -Force -ErrorAction SilentlyContinue
}

if (-not $Quiet) {
    Write-Host "SatGeoTracker dev processes stopped." -ForegroundColor Green
}
