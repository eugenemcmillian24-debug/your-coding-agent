# Railway Deployment Setup

## Prerequisites

1. Create a Railway account at https://railway.app/
2. Install Railway CLI: `npm i -g @railway/cli`
3. Login: `railway login`

## Environment Variables

In Railway, set the following environment variables:

### Required for Backend
- `DATABASE_URL` - PostgreSQL connection string (use Railway's PostgreSQL service)
- `REDIS_URL` - Redis connection string (use Railway's Redis service)
- `DEFAULT_PROVIDER` - AI provider (e.g., `opencode-go`)
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GITHUB_OWNER` - GitHub username or organization
- `GITHUB_WEBHOOK_SECRET` - Secret for GitHub webhook verification
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `CLOUDFLARE_WEBHOOK_SECRET` - Secret for Cloudflare webhook verification
- `STRIPE_SECRET_KEY` - Stripe API secret key for subscription management
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret for event verification
- `ADMIN_EMAILS` - Comma-separated list of admin emails (get free unlimited access)
- `FRONTEND_URL` - Frontend application URL for Stripe redirects

### Optional
- `OPENCODE_API_KEY` - API key for AI provider
- `OPENCODE_BASE_URL` - Base URL for AI provider
- `OPENCODE_GO_MODEL` - Model name for opencode-go
- `OPENCODE_ZEN_MODEL` - Model name for opencode-zen

## Deployment Steps

### 1. Create a New Project
```bash
railway init
```

### 2. Add Services

#### Add PostgreSQL Database
```bash
railway add postgresql
# Set the DATABASE_URL environment variable to point to this service
# Format: postgresql://postgres:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/railway
```

#### Add Redis
```bash
railway add redis
# Set the REDIS_URL environment variable to point to this service
# Format: redis://default:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}
```

#### Add Backend Service
```bash
railway up --service backend
```

#### Add Worker Service
```bash
railway up --service worker
```

### 3. Configure Environment Variables

```bash
# Set required environment variables
railway variables set DATABASE_URL="postgresql://postgres:password@host:5432/railway"
railway variables set REDIS_URL="redis://default:password@host:6379"
railway variables set DEFAULT_PROVIDER="opencode-go"
railway variables set GITHUB_TOKEN="your-github-token"
railway variables set GITHUB_OWNER="your-github-username"
railway variables set GITHUB_WEBHOOK_SECRET="your-webhook-secret"
railway variables set CLOUDFLARE_API_TOKEN="your-cloudflare-token"
railway variables set CLOUDFLARE_ACCOUNT_ID="your-account-id"
railway variables set CLOUDFLARE_WEBHOOK_SECRET="your-cloudflare-webhook-secret"
railway variables set STRIPE_SECRET_KEY="sk_live_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."
railway variables set ADMIN_EMAILS="admin@example.com,owner@example.com"
railway variables set FRONTEND_URL="https://your-frontend.vercel.app"
```

### 4. Deploy

```bash
# Deploy backend
railway up --service backend

# Deploy worker
railway up --service worker
```

## Using GitHub Actions

The repository includes a GitHub Action for automatic deployment:

1. Add `RAILWAY_TOKEN` to your GitHub repository secrets
2. Add all required environment variables as GitHub secrets
3. Push to main branch to trigger deployment

## Troubleshooting

### Backend Fails to Start

Check logs:
```bash
railway logs --service backend
```

Common issues:
- Missing environment variables
- Database connection failed (check DATABASE_URL)
- Redis connection failed (check REDIS_URL)

### Worker Not Processing Jobs

Check logs:
```bash
railway logs --service worker
```

Common issues:
- Redis connection failed
- Celery configuration incorrect
- Backend not reachable

### Database Connection Issues

Ensure SSL mode is set for Railway PostgreSQL:
```
DATABASE_URL=postgresql://postgres:password@host:5432/railway?sslmode=require
```

## Service URLs

After deployment, you can find your service URLs:

```bash
railway domain
```

## Monitoring

View metrics and logs in the Railway dashboard:
- https://railway.app/project/{your-project-id}
