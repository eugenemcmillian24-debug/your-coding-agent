#!/usr/bin/env bash
set -euo pipefail
curl -fsS http://localhost:8000/health >/dev/null
echo "API health ok"
curl -fsSI http://localhost:3000 >/dev/null
echo "Frontend reachable"
RESP=$(curl -fsS -X POST http://localhost:8000/api/jobs -H 'Content-Type: application/json' -d '{"app_name":"Smoke Test App","prompt":"build test app","provider":"opencode-go"}')
echo "$RESP" | grep -q 'job_id'
echo "Job queue ok"
