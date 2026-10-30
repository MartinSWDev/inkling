#!/bin/sh
# Start Inkling locally: API on 8000, web on 5173 (Vite proxies /api to the API).
set -e
cd "$(dirname "$0")/.."
.venv/bin/uvicorn api.main:app --reload --port 8000 &
API_PID=$!
trap 'kill $API_PID' EXIT INT TERM
cd web && npm run dev
