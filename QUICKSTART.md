# Quickstart

## Local run
1. Copy `backend/.env.example` to `backend/.env`.
2. Copy `frontend/.env.example` to `frontend/.env.local`.
3. Fill in secrets and provider settings.
4. Run `bash scripts/install.sh`.
5. Run `bash scripts/smoke-test.sh`.

## Development loop
- `bash scripts/logs.sh`
- `docker compose ps`
- `docker compose down`
