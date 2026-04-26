import os
import hmac
import hashlib
from app.services.webhooks import verify_github_signature, verify_cloudflare_signature


def test_verify_github_signature():
    os.environ["GITHUB_WEBHOOK_SECRET"] = "secret123"
    body = b'{"ok":true}'
    sig = "sha256=" + hmac.new(b"secret123", body, hashlib.sha256).hexdigest()
    assert verify_github_signature({"x-hub-signature-256": sig}, body) is True


def test_verify_github_signature_missing_header():
    os.environ["GITHUB_WEBHOOK_SECRET"] = "secret123"
    try:
        verify_github_signature({}, b"test")
    except ValueError as e:
        assert "Missing" in str(e)
        return
    assert False, "Should have raised ValueError"


def test_verify_github_signature_mismatch():
    os.environ["GITHUB_WEBHOOK_SECRET"] = "secret123"
    try:
        verify_github_signature({"x-hub-signature-256": "sha256=bad"}, b"test")
    except ValueError as e:
        assert "mismatch" in str(e)
        return
    assert False, "Should have raised ValueError"


def test_verify_cloudflare_signature():
    os.environ["CLOUDFLARE_WEBHOOK_SECRET"] = "cf-secret-456"
    body = b'{"event":"deployment_success"}'
    sig = hmac.new(b"cf-secret-456", body, hashlib.sha256).hexdigest()
    assert verify_cloudflare_signature({"cf-webhook-auth": sig}, body) is True


def test_verify_cloudflare_signature_missing_header():
    os.environ["CLOUDFLARE_WEBHOOK_SECRET"] = "cf-secret-456"
    try:
        verify_cloudflare_signature({}, b"test")
    except ValueError as e:
        assert "Missing" in str(e)
        return
    assert False, "Should have raised ValueError"


def test_verify_cloudflare_signature_mismatch():
    os.environ["CLOUDFLARE_WEBHOOK_SECRET"] = "cf-secret-456"
    try:
        verify_cloudflare_signature({"cf-webhook-auth": "bad"}, b"test")
    except ValueError as e:
        assert "mismatch" in str(e)
        return
    assert False, "Should have raised ValueError"
