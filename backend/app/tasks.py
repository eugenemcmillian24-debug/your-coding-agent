from .celery_app import celery_app
from .services.worker_pipeline import run_pipeline
@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 5})
def run_job(self, job_id: str):
    return run_pipeline(job_id)
