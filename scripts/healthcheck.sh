#!/usr/bin/env bash
set -euo pipefail
curl -fsS http://localhost:8000/health && echo
curl -I http://localhost:3000 | head -n 1
