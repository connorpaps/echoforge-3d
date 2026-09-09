@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (
  echo Python 3.11 is required. Install it from https://www.python.org/downloads/ and run this file again.
  pause
  exit /b 1
)
python scripts\setup_local.py %*
if errorlevel 1 (
  echo.
  echo EchoForge setup reported a failure. Review the message above.
  pause
  exit /b 1
)
endlocal
