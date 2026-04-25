import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from ..services.db import get_conn
from ..services.state_machine import set_state, get_state
from ..services.audit import write_audit
from ..tasks import run_job
router = APIRouter()

@router.post('')
def create_job(payload: dict):
    job_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    app_name = payload.get('app_name', 'Unnamed App')
    prompt = payload.get('prompt', '')
    provider = payload.get('provider', 'opencode-go')
    repo_name = payload.get('repo_name') or app_name.lower().replace(' ', '-')
    branch_name = f'forge/{job_id[:8]}'
    with get_conn() as conn:
        conn.execute('INSERT INTO jobs (id, app_name, prompt, provider, status, repo_name, branch_name, pr_url, deployment_id, deployment_url, deployment_state, repair_attempts, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', (job_id, app_name, prompt, provider, 'queued', repo_name, branch_name, None, None, None, None, 0, now, now))
    set_state(job_id, 'queued', 'Queued in Celery')
    write_audit(job_id, 'job_created', payload)
    run_job.delay(job_id)
    return {'job_id': job_id, 'state': get_state(job_id)}

@router.get('')
def list_jobs():
    with get_conn() as conn:
        rows = conn.execute('SELECT * FROM jobs ORDER BY created_at DESC').fetchall()
    return [dict(r) for r in rows]

@router.get('/{job_id}')
def get_job(job_id: str):
    with get_conn() as conn:
        row = conn.execute('SELECT * FROM jobs WHERE id = %s', (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Job not found')
        runs = conn.execute('SELECT stage, content, created_at FROM job_runs WHERE job_id = %s ORDER BY id ASC', (job_id,)).fetchall()
    return {**dict(row), 'runs': [dict(r) for r in runs], 'state': get_state(job_id)}
