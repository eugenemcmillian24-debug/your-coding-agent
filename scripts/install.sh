#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if ! command -v docker >/dev/null 2>&1; then echo "docker not found"; exit 1; fi
if ! docker compose version >/dev/null 2>&1; then echo "docker compose not found"; exit 1; fi
if [ ! -f backend/.env ] && [ -f backend/.env.example ]; then cp backend/.env.example backend/.env; fi
if [ ! -f frontend/.env.local ] && [ -f frontend/.env.example ]; then cp frontend/.env.example frontend/.env.local; fi
echo "Environment templates prepared. Edit backend/.env and frontend/.env.local before production use."
docker compose up --build -d
echo "Forge Agent v18 started. Frontend: http://localhost:3000 API: http://localhost:8000"
