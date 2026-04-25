from datetime import datetime
from .db import get_conn
def write_audit(job_id, event, payload):
    with get_conn() as conn:
        conn.execute('INSERT INTO audit_logs (job_id, event, payload, created_at) VALUES (%s,%s,%s,%s)', (job_id, event, str(payload), datetime.utcnow().isoformat()))
