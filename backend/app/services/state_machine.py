import logging
from datetime import datetime, timezone
from .db import get_conn

logger = logging.getLogger("forge_agent.state_machine")

ALLOWED = frozenset({
    "queued", "generated", "repairing", "validated",
    "publishing", "awaiting_review", "reviewing",
    "deploying", "finalizing", "complete", "failed",
})

TRANSITIONS = {
    "queued": {"generated", "failed"},
    "generated": {"repairing", "validated", "publishing", "failed"},
    "repairing": {"validated", "failed"},
    "validated": {"publishing", "failed"},
    "publishing": {"awaiting_review", "deploying", "failed"},
    "awaiting_review": {"reviewing", "failed"},
    "reviewing": {"deploying", "failed"},
    "deploying": {"finalizing", "complete", "failed"},
    "finalizing": {"complete", "failed"},
}


def set_state(job_id: str, state: str, details: str = ""):
    if state not in ALLOWED:
        raise ValueError(f"Invalid state: {state}")
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        row = conn.execute("SELECT state FROM run_state WHERE job_id = %s", (job_id,)).fetchone()
        if row:
            current = row["state"]
            valid_next = TRANSITIONS.get(current, set())
            if state not in valid_next and state != "failed":
                logger.warning(
                    "Invalid transition %s -> %s for job %s (allowed: %s)",
                    current, state, job_id, valid_next,
                )
            conn.execute(
                "UPDATE run_state SET state = %s, details = %s, updated_at = %s WHERE job_id = %s",
                (state, details, now, job_id),
            )
        else:
            conn.execute(
                "INSERT INTO run_state (job_id, state, details, updated_at) VALUES (%s,%s,%s,%s)",
                (job_id, state, details, now),
            )
    logger.info("Job %s state -> %s: %s", job_id, state, details)


def get_state(job_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM run_state WHERE job_id = %s", (job_id,)).fetchone()
    return dict(row) if row else None
