import os
import psycopg
from psycopg.rows import dict_row
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://forge:forge@postgres:5432/forge_agent')
def get_conn():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)
def init_db():
    with get_conn() as conn:
        conn.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, app_name TEXT NOT NULL, prompt TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, repo_name TEXT, branch_name TEXT, pr_url TEXT, deployment_id TEXT, deployment_url TEXT, deployment_state TEXT, repair_attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)')
        conn.execute('CREATE TABLE IF NOT EXISTS job_runs (id SERIAL PRIMARY KEY, job_id TEXT NOT NULL, stage TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)')
        conn.execute('CREATE TABLE IF NOT EXISTS run_state (job_id TEXT PRIMARY KEY, state TEXT NOT NULL, details TEXT, updated_at TEXT NOT NULL)')
        conn.execute('CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, job_id TEXT, event TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)')
        conn.execute('CREATE TABLE IF NOT EXISTS idempotency_records (id SERIAL PRIMARY KEY, job_id TEXT NOT NULL, action TEXT NOT NULL, idempotency_key TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL)')
        conn.execute('CREATE TABLE IF NOT EXISTS webhook_events (id SERIAL PRIMARY KEY, source TEXT NOT NULL, event_type TEXT, delivery_id TEXT, verified BOOLEAN NOT NULL DEFAULT FALSE, payload TEXT NOT NULL, created_at TEXT NOT NULL)')
