import os, hmac, hashlib
from datetime import datetime
from .db import get_conn

def verify_github_signature(headers, body: bytes):
    secret = os.getenv('GITHUB_WEBHOOK_SECRET', '')
    signature = headers.get('x-hub-signature-256') or headers.get('X-Hub-Signature-256')
    if not signature:
        raise ValueError('Missing x-hub-signature-256 header')
    expected = 'sha256=' + hmac.new(secret.encode('utf-8'), msg=body, digestmod=hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError('GitHub webhook signature mismatch')
    return True

def verify_vercel_signature(headers, body: bytes):
    secret = os.getenv('VERCEL_WEBHOOK_SECRET', '')
    signature = headers.get('x-vercel-signature') or headers.get('X-Vercel-Signature')
    if not signature:
        raise ValueError('Missing x-vercel-signature header')
    expected = hmac.new(secret.encode('utf-8'), body, hashlib.sha1).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError('Vercel webhook signature mismatch')
    return True

def record_webhook_event(source, event_type, delivery_id, payload, verified):
    with get_conn() as conn:
        conn.execute('INSERT INTO webhook_events (source, event_type, delivery_id, verified, payload, created_at) VALUES (%s,%s,%s,%s,%s,%s)', (source, event_type, delivery_id, verified, str(payload), datetime.utcnow().isoformat()))
