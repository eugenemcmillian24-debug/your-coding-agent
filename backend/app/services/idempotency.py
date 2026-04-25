from datetime import datetime
from .db import get_conn
def reserve(job_id, action, key):
    with get_conn() as conn:
        row = conn.execute('SELECT * FROM idempotency_records WHERE idempotency_key = %s', (key,)).fetchone()
        if row:
            return False
        conn.execute('INSERT INTO idempotency_records (job_id, action, idempotency_key, created_at) VALUES (%s,%s,%s,%s)', (job_id, action, key, datetime.utcnow().isoformat()))
        return True
