import os
import hmac
import hashlib
from app.services.webhooks import verify_github_signature, verify_vercel_signature

def test_verify_github_signature():
    os.environ['GITHUB_WEBHOOK_SECRET'] = 'secret123'
    body = b'{"ok":true}'
    sig = 'sha256=' + hmac.new(b'secret123', body, hashlib.sha256).hexdigest()
    assert verify_github_signature({'x-hub-signature-256': sig}, body) is True

def test_verify_vercel_signature():
    os.environ['VERCEL_WEBHOOK_SECRET'] = 'secret456'
    body = b'{"ready":true}'
    sig = hmac.new(b'secret456', body, hashlib.sha1).hexdigest()
    assert verify_vercel_signature({'x-vercel-signature': sig}, body) is True
