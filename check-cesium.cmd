@echo off
cd /d "%~dp0frontend"
node scripts\check-cesium.mjs
if errorlevel 1 (
  echo [ERROR] Cesium assets missing or invalid. Run setup.cmd.
) else (
  echo [OK] Cesium assets are present.
)
pause
