@echo off
REM ==============================================================================
REM CarbonVault Single-Command Developer Setup & Runner (Phase 3 Acceptance)
REM ==============================================================================

echo [CarbonVault] Checking environment...

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    exit /b 1
)

echo [CarbonVault] 1. Applying Alembic migrations...
cd Backend
python -m alembic upgrade head
if errorlevel 1 (
    echo [WARNING] Alembic upgrade encountered an issue; fallback to automatic engine startup.
)
cd ..

echo [CarbonVault] 2. Checking frontend dependencies...
if not exist "Frontend\node_modules" (
    echo [CarbonVault] Installing frontend dependencies...
    cd Frontend
    call npm install
    cd ..
)

echo [CarbonVault] 3. Starting Backend API and Frontend Dev Server...
start "CarbonVault API (Port 8000)" cmd /k "cd Backend && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"
start "CarbonVault Frontend (Port 5173)" cmd /k "cd Frontend && npm run dev"

echo ==============================================================================
echo [SUCCESS] CarbonVault is running!
echo Backend API:  http://127.0.0.1:8000
echo API Docs:     http://127.0.0.1:8000/docs
echo Frontend:     http://localhost:5173
echo ==============================================================================
