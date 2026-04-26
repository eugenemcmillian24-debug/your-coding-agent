# Railway Deployment Fix - PORT Environment Variable

## Problem
The Railway deployment was failing with the error:
```
Error: Invalid value for '--port': '$PORT' is not a valid integer.
```

## Root Cause
The Dockerfile was using shell variable expansion syntax `${PORT}` in the CMD instruction without proper shell invocation. In Docker's exec form (array syntax), environment variables are not expanded by the shell, so uvicorn received the literal string `$PORT` instead of the actual port number.

## Solution

### 1. Updated Dockerfile (`backend/Dockerfile`)
Changed from:
```dockerfile
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
```

To:
```dockerfile
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
```

This change:
- Uses the shell to expand the `${PORT:-8000}` variable
- Provides a fallback value of `8000` if PORT is not set
- Ensures Railway's PORT environment variable is properly resolved

### 2. Added Procfile (`backend/Procfile`)
Created a Procfile as an alternative deployment method:
```procfile
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

Railway can use this Procfile if configured to do so.

### 3. Railway Configuration (`railway.json`)
The existing `railway.json` file already contains proper configuration:
- Backend service uses Dockerfile builder
- Healthcheck path set to `/health`
- Redis and PostgreSQL services configured

## Why This Fix Works

1. **Shell Expansion**: By using `["sh", "-c", "..."]`, we invoke a shell which properly expands environment variables.

2. **Fallback Value**: `${PORT:-8000}` provides a default of 8000 if PORT is not set, making the container work in both Railway and local environments.

3. **Railway Environment**: Railway automatically sets the `PORT` environment variable for containers. The shell expansion ensures this variable is resolved at runtime.

## Deployment Steps

1. Ensure the Dockerfile and Procfile changes are committed
2. Push to the connected Git repository
3. Railway will automatically build and deploy
4. The healthcheck at `/health` will verify the service is running correctly

## Verification

After deployment, verify:
- Service starts without errors
- Healthcheck endpoint returns 200 OK
- Logs show uvicorn running on the correct port (e.g., `INFO:     Uvicorn running on http://0.0.0.0:8000`)
- No more `'$PORT' is not a valid integer` errors

## Environment Variables

Required environment variables for Railway deployment:
- `PORT` - Automatically set by Railway
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `GITHUB_TOKEN` - GitHub API token for repository operations
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token for deployment
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
