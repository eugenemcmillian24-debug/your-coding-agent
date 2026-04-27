from app.services.env_validation import validate_env

def test_validate_env_missing(monkeypatch):
    keys = [
        'DATABASE_URL','REDIS_URL','DEFAULT_PROVIDER','GITHUB_TOKEN','GITHUB_OWNER',
        'GITHUB_WEBHOOK_SECRET','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_WEBHOOK_SECRET',
    ]
    for key in keys:
        monkeypatch.delenv(key, raising=False)
    missing = validate_env()
    assert 'DATABASE_URL' in missing
    assert 'CLOUDFLARE_API_TOKEN' in missing
