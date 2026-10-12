$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Root "frontend"
$RunDir = Join-Path $Root ".run"
$PidFile = Join-Path $RunDir "frontend.pid"

$Node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $Node) {
    $Node = "C:\Program Files\nodejs\node.exe"
}

if (-not (Test-Path $Node)) {
    throw "Node.js not found. Run setup.cmd first."
}

$Vite = Join-Path $Frontend "node_modules\vite\bin\vite.js"
if (-not (Test-Path $Vite)) {
    throw "Vite not found. Run setup.cmd first."
}

New-Item -ItemType Directory -Force $RunDir | Out-Null
Set-Content -Path $PidFile -Value $PID -Encoding ascii

try {
    Set-Location $Frontend
    Write-Host "[SGT frontend] http://127.0.0.1:5173" -ForegroundColor Cyan
    & $Node $Vite --host 127.0.0.1 --port 5173 --strictPort
}
finally {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}
