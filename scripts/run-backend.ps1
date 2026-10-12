$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"
$RunDir = Join-Path $Root ".run"
$PidFile = Join-Path $RunDir "backend.pid"

New-Item -ItemType Directory -Force $RunDir | Out-Null
Set-Content -Path $PidFile -Value $PID -Encoding ascii

try {
    Set-Location $Backend
    Write-Host "[SGT backend] http://127.0.0.1:8000" -ForegroundColor Cyan
    & $Python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
}
finally {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}
