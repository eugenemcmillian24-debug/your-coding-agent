#!/bin/bash
set -e

echo "Starting Forge Agent Backend..."

# Wait for Redis to be ready
if [ -n "$REDIS_URL" ]; then
    echo "Waiting for Redis..."
    timeout 30s bash -c 'until nc -z ${REDIS_HOST:-localhost} ${REDIS_PORT:-6379}; do sleep 1; done' || echo "Redis connection timeout - will continue anyway"
fi

# Wait for PostgreSQL to be ready
if [ -n "$DATABASE_URL" ]; then
    echo "Waiting for PostgreSQL..."
    timeout 30s bash -c 'until nc -z ${DB_HOST:-localhost} ${DB_PORT:-5432}; do sleep 1; done' || echo "PostgreSQL connection timeout - will continue anyway"
fi

# Run the application
echo "Starting Uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
