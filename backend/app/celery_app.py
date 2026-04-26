import os
import sys
print(">>> CELERY_APP MODULE LOADING v3 <<<", file=sys.stderr, flush=True)

from celery import Celery

celery_app = Celery(
    'forge_agent',
    broker=os.getenv('REDIS_URL', 'redis://redis:6379/0'),
    backend=os.getenv('REDIS_URL', 'redis://redis:6379/0'),
)
celery_app.conf.task_routes = {'app.tasks.*': {'queue': 'forge'}}

@celery_app.task(bind=True, name='app.tasks.run_job', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 5})
def run_job(self, job_id: str):
    from app.services.worker_pipeline import run_pipeline
    return run_pipeline(job_id)

print(f">>> REGISTERED TASKS: {list(celery_app.tasks.keys())} <<<", file=sys.stderr, flush=True)
