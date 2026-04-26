# Forge Agent

AI-powered code generation → GitHub publishing → Vercel deployment pipeline.

[![CI](https://github.com/eugenemcmillian24-debug/your-coding-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/eugenemcmillian24-debug/your-coding-agent/actions)

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────┐     ┌─────────┐
│  Next.js UI │────▶│  FastAPI     │────▶│  Celery   │────▶│ GitHub  │
│  (React 19) │     │  Backend     │     │  Worker   │     │  API    │
└─────────────┘     └──────┬──────┘     └──────┬────┘     └─────────┘
                           │                    │
                    ┌──────┴──────┐      ┌──────┴────┐     ┌─────────┐
                    │  PostgreSQL  │      │   Redis    │     │ Vercel  │
                    │  (state)     │      │  (broker)  │     │  API    │
                    └──────────────┘      └───────────┘     └─────────┘
```

**Stack:** Python 3.12 · FastAPI · Celery · PostgreSQL 16 · Redis 7 · Next.js 15 · React 19 · Docker Compose

## Quick Start

### Prerequisites
- Docker & Docker Compose v2+
- GitHub Personal Access Token (repo scope)
- Vercel API Token (optional, for deployment)

### 1. Clone & configure

```bash
git clone https://github.com/eugenemcmillian24-debug/your-coding-agent.git
cd your-coding-agent
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` with your credentials (see [Environment Variables](#environment-variables) below).

### 2. Start everything

```bash
bash scripts/install.sh
# or manually:
docker compose up --build -d
```

### 3. Verify

```bash
bash scripts/smoke-test.sh
```

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `DEFAULT_PROVIDER` | Yes | AI provider (`opencode-go` or `opencode-zen`) |
| `OPENCODE_API_KEY` | No | API key for the AI provider |
| `OPENCODE_BASE_URL` | No | Base URL for the AI provider |
| `OPENCODE_GO_MODEL` | No | Model name for opencode-go |
| `OPENCODE_ZEN_MODEL` | No | Model name for opencode-zen |
| `GITHUB_TOKEN` | Yes | GitHub PAT with repo scope |
| `GITHUB_OWNER` | Yes | GitHub username or org |
| `GITHUB_WEBHOOK_SECRET` | Yes | Secret for GitHub webhook verification |
| `VERCEL_TOKEN` | Yes | Vercel API token |
| `VERCEL_TEAM_ID` | No | Vercel team ID (if using team) |
| `VERCEL_WEBHOOK_SECRET` | Yes | Secret for Vercel webhook verification |

## API Reference

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/jobs` | Create a new build job |
| `GET` | `/api/jobs` | List all jobs (supports `?limit=&offset=`) |
| `GET` | `/api/jobs/:id` | Get job details with run history |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/stuck-jobs` | List stuck (non-terminal) jobs |
| `POST` | `/api/admin/replay/:id` | Re-queue a stuck job |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhooks/github` | GitHub webhook receiver |
| `POST` | `/api/webhooks/vercel` | Vercel webhook receiver |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check with version |

## Pipeline States

```
queued → generated → publishing → deploying → complete
                 ↘ repairing ↗         ↘ failed
```

## Development

```bash
# Run tests
cd backend && pip install -r requirements.txt && pytest -v --cov=app

# View logs
bash scripts/logs.sh

# Stop everything
bash scripts/stop.sh
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/install.sh` | One-command setup (copies envs + starts containers) |
| `scripts/start.sh` | Start all services |
| `scripts/stop.sh` | Stop all services |
| `scripts/logs.sh` | Tail container logs |
| `scripts/healthcheck.sh` | Quick health verification |
| `scripts/smoke-test.sh` | End-to-end smoke test |
| `scripts/bootstrap.sh` | Pre-flight checks |

## License

MIT
