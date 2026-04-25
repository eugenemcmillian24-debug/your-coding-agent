import logging
from .db import get_conn
from ..tasks import run_job

logger = logging.getLogger("forge_agent.recovery")


def list_stuck_jobs() -> list[dict]:
    """Return jobs in non-terminal states, oldest first."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM jobs WHERE status NOT IN ('complete','failed') ORDER BY updated_at ASC"
        ).fetchall()
    return [dict(r) for r in rows]


def replay_job(job_id: str) -> dict:
    """Re-queue a job for pipeline replay."""
    logger.info("Replaying job %s", job_id)
    run_job.delay(job_id)
    return {"replayed": True, "job_id": job_id}
