@echo off
setlocal
cd /d "%~dp0"
node --experimental-strip-types --test tests\station-markers.test.mjs
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
