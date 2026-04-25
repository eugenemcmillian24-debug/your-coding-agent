from datetime import datetime
from .db import get_conn
ALLOWED = {'queued','generated','repairing','validated','publishing','awaiting_review','reviewing','deploying','finalizing','complete','failed'}
def set_state(job_id: str, state: str, details: str = ''):
    if state not in ALLOWED: raise ValueError('Invalid state')
    with get_conn() as conn:
        row = conn.execute('SELECT job_id FROM run_state WHERE job_id = %s', (job_id,)).fetchone()
        if row:
            conn.execute('UPDATE run_state SET state = %s, details = %s, updated_at = %s WHERE job_id = %s', (state, details, datetime.utcnow().isoformat(), job_id))
        else:
            conn.execute('INSERT INTO run_state (job_id, state, details, updated_at) VALUES (%s,%s,%s,%s)', (job_id, state, details, datetime.utcnow().isoformat()))
def get_state(job_id: str):
    with get_conn() as conn:
        row = conn.execute('SELECT * FROM run_state WHERE job_id = %s', (job_id,)).fetchone()
    return dict(row) if row else None
