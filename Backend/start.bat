@echo off
echo ========================================
echo   CarbonVault Backend Startup
echo ========================================
echo.

cd /d "%~dp0"

REM Activate virtual environment if present
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else if exist ..\venv\Scripts\activate.bat (
    call ..\venv\Scripts\activate.bat
)

echo Starting FastAPI server on http://127.0.0.1:8000
echo Press Ctrl+C to stop
echo.
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
