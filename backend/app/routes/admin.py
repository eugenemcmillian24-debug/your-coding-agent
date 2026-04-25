from fastapi import APIRouter
from ..services.recovery import replay_job, list_stuck_jobs
router = APIRouter()
@router.get('/stuck-jobs')
def stuck_jobs():
    return list_stuck_jobs()
@router.post('/replay/{job_id}')
def replay(job_id: str):
    return replay_job(job_id)
