@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\satellite.js\package.json" (
  echo [ERROR] Frontend dependencies not installed. Run setup.cmd first.
  pause
  exit /b 1
)
node --experimental-strip-types --test tests\orbital-geometry.test.mjs tests\sgp4-geo-reference.test.mjs
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (echo [FAIL] Orbit tests failed.) else (echo [OK] Orbit tests passed.)
pause
exit /b %RESULT%
