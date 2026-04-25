# Deployment Guide

## Local
- Copy `backend/.env.example` to `backend/.env`
- Copy `frontend/.env.example` to `frontend/.env.local`
- Run `bash scripts/install.sh`
- Verify with `bash scripts/smoke-test.sh`

## GitHub
Required repository secrets for CI and deployment expansion:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_WEBHOOK_SECRET`
- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID`
- `VERCEL_WEBHOOK_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `DEFAULT_PROVIDER`

## Production notes
- Confirm webhook signature handling against your live providers.
- Validate idempotent publish/deploy stages against retries.
- Rotate tokens and webhook secrets regularly.
