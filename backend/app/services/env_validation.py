import os
from typing import List

def required_env_keys() -> List[str]:
    return [
        'DATABASE_URL',
        'REDIS_URL',
        'DEFAULT_PROVIDER',
        'GITHUB_TOKEN',
        'GITHUB_OWNER',
        'GITHUB_WEBHOOK_SECRET',
        'VERCEL_TOKEN',
        'VERCEL_WEBHOOK_SECRET',
    ]

def validate_env() -> List[str]:
    return [key for key in required_env_keys() if not os.getenv(key)]
