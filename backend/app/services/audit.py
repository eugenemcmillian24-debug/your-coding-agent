import json
import logging
from datetime import datetime, timezone
from .db import get_conn

logger = logging.getLogger("forge_agent.audit")


def write_audit(job_id: str, event: str, payload: dict | list | str):
    """Write an immutable audit log entry."""
    serialized = json.dumps(payload) if not isinstance(payload, str) else payload
    try:
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO audit_logs (job_id, event, payload, created_at) VALUES (%s,%s,%s,%s)",
                (job_id, event, serialized, datetime.now(timezone.utc).isoformat()),
            )
    except Exception:
        logger.exception("Failed to write audit log for job %s event %s", job_id, event)
