from datetime import datetime, timezone
from .db import get_conn


def reserve(job_id: str, action: str, key: str) -> bool:
    """
    Attempt to reserve an idempotency key.
    Returns True if reserved (first time), False if already seen.
    """
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM idempotency_records WHERE idempotency_key = %s",
            (key,),
        ).fetchone()
        if row:
            return False
        conn.execute(
            "INSERT INTO idempotency_records (job_id, action, idempotency_key, created_at) VALUES (%s,%s,%s,%s)",
            (job_id, action, key, datetime.now(timezone.utc).isoformat()),
        )
        return True
