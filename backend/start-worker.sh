#!/bin/bash
set -e

echo "Starting Forge Agent Celery Worker..."

# Wait for Redis to be ready
if [ -n "$REDIS_URL" ]; then
    echo "Waiting for Redis..."
    timeout 30s bash -c 'until nc -z ${REDIS_HOST:-localhost} ${REDIS_PORT:-6379}; do sleep 1; done' || echo "Redis connection timeout - will continue anyway"
fi

# Wait for Backend to be ready
if [ -n "BACKEND_URL" ]; then
    echo "Waiting for Backend..."
    timeout 30s bash -c 'until nc -z ${BACKEND_HOST:-localhost} ${BACKEND_PORT:-8000}; do sleep 1; done' || echo "Backend connection timeout - will continue anyway"
fi

# Run the worker
echo "Starting Celery worker..."
exec celery -A app.celery_app.celery_app worker --loglevel=info --concurrency=2
