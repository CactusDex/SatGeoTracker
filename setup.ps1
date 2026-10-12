$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

function Resolve-NodeRoot {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        return Split-Path -Parent $nodeCommand.Source
    }

    $default = "C:\Program Files\nodejs"
    if (Test-Path (Join-Path $default "node.exe")) {
        return $default
    }

    throw "Node.js not found. Install Node.js LTS first."
}

function Resolve-PythonLauncher {
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        return @{ Path = $py.Source; Args = @("-3") }
    }

    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) {
        return @{ Path = $python.Source; Args = @() }
    }

    throw "Python 3 not found."
}

function Copy-CesiumRuntime {
    param([string]$FrontendPath)

    $sourceRoot = Join-Path $FrontendPath "node_modules\cesium\Build\Cesium"
    $targetRoot = Join-Path $FrontendPath "public\cesium"

    if (-not (Test-Path $sourceRoot)) {
        throw "Cesium package was not installed: $sourceRoot"
    }

    New-Item -ItemType Directory -Force $targetRoot | Out-Null

    foreach ($dir in @("Assets", "ThirdParty", "Workers", "Widgets")) {
        $source = Join-Path $sourceRoot $dir
        $target = Join-Path $targetRoot $dir

        Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item $source $target -Recurse -Force
    }
}

Write-Host "=== SatGeoTracker setup ===" -ForegroundColor Cyan

$nodeRoot = Resolve-NodeRoot
$node = Join-Path $nodeRoot "node.exe"
$npm = Join-Path $nodeRoot "npm.cmd"

Write-Host "Node:" -NoNewline
& $node -v

$venvPython = Join-Path $Backend ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating backend virtual environment..."
    $launcher = Resolve-PythonLauncher
    $venvArgs = @()
    $venvArgs += $launcher.Args
    $venvArgs += @("-m", "venv", (Join-Path $Backend ".venv"))
    & $launcher.Path @venvArgs
}

Write-Host "Installing backend dependencies..."
& $venvPython -m pip install -r (Join-Path $Backend "requirements.txt")

Write-Host "Installing frontend dependencies..."
Push-Location $Frontend
try {
    & $npm install
}
finally {
    Pop-Location
}

Write-Host "Copying Cesium runtime assets..."
Copy-CesiumRuntime -FrontendPath $Frontend

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Next: .\dev.cmd"
