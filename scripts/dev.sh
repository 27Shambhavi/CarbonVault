#!/usr/bin/env bash
# ==============================================================================
# CarbonVault Single-Command Developer Setup & Runner (Phase 3 Acceptance)
# ==============================================================================
set -e

echo "[CarbonVault] Checking environment..."
command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1 || { echo "[ERROR] Python is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "[ERROR] Node.js is required but not installed."; exit 1; }

PYTHON_CMD="python3"
if ! command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python"
fi

echo "[CarbonVault] 1. Applying Alembic migrations..."
(cd Backend && $PYTHON_CMD -m alembic upgrade head || true)

echo "[CarbonVault] 2. Checking frontend dependencies..."
if [ ! -d "Frontend/node_modules" ]; then
    echo "[CarbonVault] Installing frontend dependencies..."
    (cd Frontend && npm install)
fi

echo "[CarbonVault] 3. Starting Backend API and Frontend Dev Server..."
(cd Backend && $PYTHON_CMD -m uvicorn main:app --reload --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!

(cd Frontend && npm run dev) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT

echo "=============================================================================="
echo "[SUCCESS] CarbonVault is running!"
echo "Backend API:  http://127.0.0.1:8000"
echo "API Docs:     http://127.0.0.1:8000/docs"
echo "Frontend:     http://localhost:5173"
echo "=============================================================================="

wait
