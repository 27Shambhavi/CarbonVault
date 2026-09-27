#!/bin/bash
set -e

# Change directory to Backend
cd "$(dirname "$0")"

# Activate venv if exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Run uvicorn server
echo "Starting CarbonVault Backend..."
uvicorn main:app --reload --host 127.0.0.1 --port 8000
