import logging
from fastapi import APIRouter, HTTPException
from ..services.recovery import replay_job, list_stuck_jobs

router = APIRouter()
logger = logging.getLogger("forge_agent.admin")


@router.get("/stuck-jobs")
def stuck_jobs():
    """List jobs stuck in non-terminal states."""
    return list_stuck_jobs()


@router.post("/replay/{job_id}")
def replay(job_id: str):
    """Re-queue a stuck job for replay."""
    logger.warning("Admin replay requested for job %s", job_id)
    return replay_job(job_id)
