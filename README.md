# Forge Agent v17 Real Integrations

Forge Agent v17 upgrades the merged repository with more realistic integration code:
- GitHub webhook HMAC SHA-256 verification
- Vercel webhook signature verification helper
- GitHub repo, branch, file, PR, and review API scaffolding
- Vercel project/deployment/env API scaffolding
- Celery worker pipeline calling publish/deploy services
- Installer scripts and local setup docs retained

## Quick start
1. Copy `backend/.env.example` to `backend/.env`.
2. Copy `frontend/.env.example` to `frontend/.env.local`.
3. Fill provider, GitHub, and Vercel credentials.
4. Run `bash scripts/bootstrap.sh`.
5. Run `bash scripts/start.sh`.
