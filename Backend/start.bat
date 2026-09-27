@echo off
echo ========================================
echo   CarbonVault Backend Startup
echo ========================================
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

echo Installing/updating dependencies...
pip install -r requirements.txt --quiet

echo.
echo Starting FastAPI server on http://127.0.0.1:8000
echo Press Ctrl+C to stop
echo.
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
