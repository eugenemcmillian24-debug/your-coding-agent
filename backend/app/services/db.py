import os
import ssl
import logging
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from contextlib import contextmanager

logger = logging.getLogger("forge_agent.db")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://forge:forge@postgres:5432/forge_agent")

_pool: ConnectionPool | None = None


def _pool_kwargs() -> dict:
    """Build connection kwargs — add SSL if connecting to Supabase/external host."""
    kwargs = {"row_factory": dict_row}

    # Detect external DB (Supabase pooler or direct) by host pattern
    if "supabase" in DATABASE_URL or "pooler" in DATABASE_URL:
        kwargs["sslmode"] = "require"
        logger.info("SSL mode enabled for external database connection")

    return kwargs


def get_pool() -> ConnectionPool:
    """Get or create the connection pool (lazy singleton)."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            kwargs=_pool_kwargs(),
        )
        logger.info("Connection pool initialized (min=2, max=10)")
    return _pool


@contextmanager
def get_conn():
    """Yield a connection from the pool with auto-commit."""
    pool = get_pool()
    with pool.connection() as conn:
        conn.autocommit = True
        yield conn


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                app_name TEXT NOT NULL,
                prompt TEXT NOT NULL,
                provider TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                repo_name TEXT,
                branch_name TEXT,
                pr_url TEXT,
                deployment_id TEXT,
                deployment_url TEXT,
                deployment_state TEXT,
                repair_attempts INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS job_runs (
                id SERIAL PRIMARY KEY,
                job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                stage TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_job_runs_job_id ON job_runs(job_id)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS run_state (
                job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
                state TEXT NOT NULL,
                details TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                job_id TEXT,
                event TEXT NOT NULL,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_logs_job_id ON audit_logs(job_id)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS idempotency_records (
                id SERIAL PRIMARY KEY,
                job_id TEXT NOT NULL,
                action TEXT NOT NULL,
                idempotency_key TEXT UNIQUE NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS webhook_events (
                id SERIAL PRIMARY KEY,
                source TEXT NOT NULL,
                event_type TEXT,
                delivery_id TEXT,
                verified BOOLEAN NOT NULL DEFAULT FALSE,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source)
        """)
        logger.info("Database tables initialized")
