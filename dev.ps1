param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$BackendPython = Join-Path $Root "backend\.venv\Scripts\python.exe"
$Vite = Join-Path $Root "frontend\node_modules\vite\bin\vite.js"
$CesiumWorker = Join-Path $Root "frontend\public\cesium\Workers"
$Setup = Join-Path $Root "setup.ps1"
$Stop = Join-Path $Root "stop-dev.ps1"

if (
    -not (Test-Path $BackendPython) -or
    -not (Test-Path $Vite) -or
    -not (Test-Path $CesiumWorker)
) {
    Write-Host "Dependencies are incomplete; running setup..." -ForegroundColor Yellow
    & $Setup
}

# Stop only processes previously started by SatGeoTracker launch scripts.
& $Stop -Quiet

$backendScript = Join-Path $Root "scripts\run-backend.ps1"
$frontendScript = Join-Path $Root "scripts\run-frontend.ps1"

Write-Host "Starting SatGeoTracker..." -ForegroundColor Cyan

Start-Process powershell.exe -WorkingDirectory $Root -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$backendScript`""
) | Out-Null

Start-Sleep -Milliseconds 500

Start-Process powershell.exe -WorkingDirectory $Root -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$frontendScript`""
) | Out-Null

function Wait-Http {
    param(
        [string]$Url,
        [int]$Seconds = 30
    )

    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    } while ((Get-Date) -lt $deadline)

    return $false
}

$backendReady = Wait-Http -Url "http://127.0.0.1:8000/health" -Seconds 30
$frontendReady = Wait-Http -Url "http://127.0.0.1:5173/" -Seconds 30

Write-Host ""
Write-Host ("Backend : " + $(if ($backendReady) { "READY" } else { "NOT READY" })) -ForegroundColor $(if ($backendReady) { "Green" } else { "Red" })
Write-Host ("Frontend: " + $(if ($frontendReady) { "READY" } else { "NOT READY" })) -ForegroundColor $(if ($frontendReady) { "Green" } else { "Red" })

if ($frontendReady -and -not $NoBrowser) {
    Start-Process "http://127.0.0.1:5173/"
}

if (-not $backendReady -or -not $frontendReady) {
    Write-Host "Check the two SatGeoTracker terminal windows for the exact error." -ForegroundColor Yellow
    exit 1
}
