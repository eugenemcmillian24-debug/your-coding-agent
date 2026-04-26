import os
import logging
from celery import Celery

logger = logging.getLogger("forge_agent.celery")

celery_app = Celery(
    'forge_agent',
    broker=os.getenv('REDIS_URL', 'redis://redis:6379/0'),
    backend=os.getenv('REDIS_URL', 'redis://redis:6379/0'),
    include=['app.tasks'],
)
celery_app.conf.task_routes = {'app.tasks.*': {'queue': 'forge'}}

# Force import tasks at module level to catch errors
try:
    from app import tasks  # noqa: F401
    logger.info("Tasks module imported successfully: %s", dir(tasks))
except Exception as e:
    logger.error("FAILED to import tasks module: %s", e, exc_info=True)
