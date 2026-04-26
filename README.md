# Forge Agent

AI-powered code generation → GitHub publishing → Cloudflare Pages deployment pipeline.

[![CI](https://github.com/eugenemcmillian24-debug/your-coding-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/eugenemcmillian24-debug/your-coding-agent/actions)

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────┐     ┌─────────┐
│  Next.js UI │────▶│  FastAPI     │────▶│  Celery   │────▶│ GitHub  │
│  (React 19) │     │  Backend     │     │  Worker   │     │  API    │
└─────────────┘     └──────┬──────┘     └──────┬────┘     └─────────┘
                           │                    │
                    ┌──────┴──────┐      ┌──────┴────┐     ┌────────────┐
                    │  PostgreSQL  │      │   Redis    │     │ Cloudflare │
                    │  (state)     │      │  (broker)  │     │   Pages    │
                    └──────────────┘      └───────────┘     └────────────┘
```

**Stack:** Python 3.12 · FastAPI · Celery · PostgreSQL 16 · Redis 7 · Next.js 15 · React 19 · Docker Compose · Railway

## Quick Start

### Prerequisites
- Docker & Docker Compose v2+
- GitHub Personal Access Token (repo scope)
- Cloudflare API Token (for deployment)

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
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token with Pages permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `CLOUDFLARE_WEBHOOK_SECRET` | Yes | Secret for Cloudflare webhook verification |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key for subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `ADMIN_EMAILS` | No | Comma-separated admin emails (get free unlimited access) |
| `FRONTEND_URL` | Yes | Frontend application URL for Stripe redirects |

### Cloudflare Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **API Tokens** → Create Token
2. Use the **Edit Cloudflare Workers** template or create a custom token with:
   - `Account.Cloudflare Pages: Edit`
   - `Account.Account Settings: Read`
3. Copy your **Account ID** from the dashboard sidebar
4. Set a webhook secret for deploy event verification

### Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) → **Developers** → **API keys**
2. Copy your **Secret key** (starts with `sk_live_` for production, `sk_test_` for testing)
3. Go to **Webhooks** → **Add endpoint** to create a webhook:
   - Endpoint URL: `https://your-backend.railway.app/api/webhooks/stripe`
   - Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy the **Signing secret** (starts with `whsec_`)
4. Configure subscription prices/tiers in Stripe Products
5. Set `ADMIN_EMAILS` to grant free unlimited access to specific users (comma-separated)

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
| `POST` | `/api/webhooks/cloudflare` | Cloudflare Pages webhook receiver |

### Stripe

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stripe/plans` | List available subscription plans |
| `POST` | `/api/stripe/checkout` | Create Stripe checkout session |
| `POST` | `/api/stripe/portal` | Create billing portal session |
| `POST` | `/api/webhooks/stripe` | Stripe webhook receiver |
| `GET` | `/api/stripe/subscription/{email}` | Get subscription status for user |

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

## Railway Deployment

For production deployment on Railway, see [RAILWAY_SETUP.md](./RAILWAY_SETUP.md).

### Quick Railway Setup

1. Install Railway CLI: `npm i -g @railway/cli`
2. Create a new project and add services (PostgreSQL, Redis, Backend, Worker)
3. Configure environment variables
4. Deploy with GitHub Actions or `railway up`

### Environment Variables

See [Environment Variables](#environment-variables) section above for required variables.

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
