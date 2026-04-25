# v18 Upgrade Notes

This version adds:
- Required environment validation at backend startup
- Pytest coverage for webhook verification, idempotency, and invalid state handling
- `scripts/install.sh` for one-command local bootstrap
- `scripts/smoke-test.sh` for quick runtime verification

## Run
1. `bash scripts/install.sh`
2. `bash scripts/smoke-test.sh`
3. `docker compose logs -f`
