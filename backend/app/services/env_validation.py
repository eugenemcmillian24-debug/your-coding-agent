import os
from typing import List


def required_env_keys() -> List[str]:
    return [
        "DATABASE_URL",
        "REDIS_URL",
        "DEFAULT_PROVIDER",
        "GITHUB_TOKEN",
        "GITHUB_OWNER",
        "GITHUB_WEBHOOK_SECRET",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_WEBHOOK_SECRET",
    ]


def optional_env_keys() -> List[str]:
    """Keys that are useful but not required for startup."""
    return [
        "DIRECT_DATABASE_URL",
        "FRONTEND_URL",
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "OPENCODE_API_KEY",
        "OPENCODE_GO_API_KEY",
        "OPENCODE_ZEN_API_KEY",
        "OPENCODE_BASE_URL",
        "OPENCODE_GO_MODEL",
        "OPENCODE_ZEN_MODEL",
        "OPENCODE_SMALL_MODEL",
    ]


def validate_env() -> List[str]:
    return [key for key in required_env_keys() if not os.getenv(key)]
