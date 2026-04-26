import os
import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone
from .db import get_conn

logger = logging.getLogger("forge_agent.webhooks")


def verify_github_signature(headers: dict, body: bytes) -> bool:
    """Verify GitHub webhook HMAC SHA-256 signature."""
    secret = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    signature = headers.get("x-hub-signature-256") or headers.get("X-Hub-Signature-256")
    if not signature:
        raise ValueError("Missing x-hub-signature-256 header")
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), msg=body, digestmod=hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("GitHub webhook signature mismatch")
    return True


def verify_cloudflare_signature(headers: dict, body: bytes) -> bool:
    """
    Verify Cloudflare Pages webhook signature.
    Cloudflare Pages Deploy Hooks use a shared secret for HMAC SHA-256.
    """
    secret = os.getenv("CLOUDFLARE_WEBHOOK_SECRET", "")
    signature = headers.get("cf-webhook-auth") or headers.get("CF-Webhook-Auth")
    if not signature:
        raise ValueError("Missing cf-webhook-auth header")
    expected = hmac.new(secret.encode("utf-8"), msg=body, digestmod=hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("Cloudflare webhook signature mismatch")
    return True


def record_webhook_event(source: str, event_type: str, delivery_id: str, payload: dict, verified: bool):
    """Record a webhook event to the database."""
    serialized = json.dumps(payload) if isinstance(payload, dict) else str(payload)
    try:
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO webhook_events (source, event_type, delivery_id, verified, payload, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
                (source, event_type, delivery_id or "", verified, serialized, datetime.now(timezone.utc).isoformat()),
            )
    except Exception:
        logger.exception("Failed to record webhook event from %s", source)
