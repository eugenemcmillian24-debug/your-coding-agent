from .db import get_conn
from ..tasks import run_job
def list_stuck_jobs():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM jobs WHERE status NOT IN ('complete','failed') ORDER BY updated_at ASC").fetchall()
    return [dict(r) for r in rows]
def replay_job(job_id):
    run_job.delay(job_id)
    return {'replayed': True, 'job_id': job_id}
