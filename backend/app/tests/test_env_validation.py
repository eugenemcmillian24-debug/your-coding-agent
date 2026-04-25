from app.services.env_validation import validate_env

def test_validate_env_missing(monkeypatch):
    keys = [
        'DATABASE_URL','REDIS_URL','DEFAULT_PROVIDER','GITHUB_TOKEN','GITHUB_OWNER',
        'GITHUB_WEBHOOK_SECRET','VERCEL_TOKEN','VERCEL_WEBHOOK_SECRET'
    ]
    for key in keys:
        monkeypatch.delenv(key, raising=False)
    missing = validate_env()
    assert 'DATABASE_URL' in missing
    assert 'VERCEL_TOKEN' in missing
