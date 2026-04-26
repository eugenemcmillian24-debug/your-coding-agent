import os
from celery import Celery

celery_app = Celery(
    'forge_agent',
    broker=os.getenv('REDIS_URL', 'redis://redis:6379/0'),
    backend=os.getenv('REDIS_URL', 'redis://redis:6379/0'),
    include=['app.tasks'],
)
celery_app.conf.task_routes = {'app.tasks.*': {'queue': 'forge'}}
