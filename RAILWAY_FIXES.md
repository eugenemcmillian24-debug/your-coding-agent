# Railway Deployment Fixes

This document summarizes the fixes applied to resolve Railway deployment failures for the FastAPI backend.

## Problems Identified

1. **Missing Procfile** - Railway needs a Procfile to know how to start services
2. **Missing Railway configuration** - No `railway.json` or service definitions
3. **Dockerfile not optimized** - Used multiple workers which can exceed Railway's resource limits
4. **Missing worker service configuration** - Celery worker had no dedicated Dockerfile
5. **No startup scripts** - Services didn't wait for dependencies (Redis, PostgreSQL)
6. **Missing deployment documentation** - No guidance for Railway setup

## Solutions Implemented

### 1. Procfile (`backend/Procfile`)
- Defines `web` process for FastAPI backend
- Defines `worker` process for Celery worker
- Uses single worker configuration suitable for Railway

### 2. Railway Configuration Files

#### `railway.json` (Project root)
- Defines all services: backend, worker, redis, postgres
- Configures healthchecks and restart policies
- Specifies Dockerfile builder and contexts

#### `backend/railway.json` (Backend-specific)
- Backend-specific Railway configuration
- Healthcheck endpoint configuration
- Restart policies for resilience

### 3. Dockerfiles

#### `backend/Dockerfile` (Updated)
- Changed from 2 workers to 1 worker (better for Railway's smaller instances)
- Added `--upgrade pip` for better dependency management
- Added explanatory comments

#### `backend/Dockerfile.worker` (New)
- Dedicated Dockerfile for Celery worker
- Runs Celery worker command instead of Uvicorn

### 4. Startup Scripts

#### `backend/start.sh`
- Waits for Redis and PostgreSQL to be ready
- Provides better logging
- Starts FastAPI backend with proper error handling

#### `backend/start-worker.sh`
- Waits for Redis to be ready
- Waits for Backend service to be ready
- Starts Celery worker with proper error handling

### 5. Additional Files

#### `backend/.railwayignore`
- Excludes unnecessary files from Railway deployment
- Reduces build size and deployment time

#### `backend/nixpacks.toml`
- Alternative Nixpacks configuration
- Can be used as fallback or alternative to Dockerfile

### 6. Documentation

#### `RAILWAY_SETUP.md`
- Comprehensive Railway deployment guide
- Step-by-step setup instructions
- Environment variable configuration
- Troubleshooting section

#### Updated `README.md`
- Added Railway deployment section
- Linked to RAILWAY_SETUP.md
- Updated tech stack to include Railway

### 7. GitHub Actions

#### `.github/workflows/deploy-backend.yml` (Updated)
- Added deployment verification step
- Better logging for debugging
- Added status check after deployment

## Required Environment Variables for Railway

The following environment variables must be set in Railway:

**Required:**
- `DATABASE_URL` - PostgreSQL connection (Railway provides this)
- `REDIS_URL` - Redis connection (Railway provides this)
- `DEFAULT_PROVIDER` - AI provider name
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GITHUB_OWNER` - GitHub username/organization
- `GITHUB_WEBHOOK_SECRET` - Webhook verification secret
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `CLOUDFLARE_WEBHOOK_SECRET` - Cloudflare webhook secret

**Optional:**
- `OPENCODE_API_KEY` - AI provider API key
- `OPENCODE_BASE_URL` - AI provider base URL
- `OPENCODE_GO_MODEL` - Model name for opencode-go
- `OPENCODE_ZEN_MODEL` - Model name for opencode-zen

## Deployment Steps

1. Create Railway project
2. Add services: PostgreSQL, Redis, Backend, Worker
3. Set environment variables
4. Deploy using GitHub Actions or Railway CLI

## Key Improvements

1. **Resource Efficiency**: Single worker configuration fits Railway's resource limits
2. **Resilience**: Startup scripts wait for dependencies
3. **Health Checks**: Proper healthcheck endpoints configured
4. **Restart Policies**: Automatic restart on failure
5. **Documentation**: Complete setup guide for future reference

## Testing

After deployment, verify:
- Backend health check: `https://your-backend.railway.app/health`
- Worker logs show successful connection to Redis
- Database tables are created on startup
- API endpoints are accessible

## Troubleshooting

Check logs if deployment fails:
```bash
railway logs --service backend
railway logs --service worker
```

Common issues:
- Missing environment variables → Add in Railway dashboard
- Database connection failed → Check DATABASE_URL includes sslmode=require
- Worker not processing jobs → Verify REDIS_URL and Redis service is running
