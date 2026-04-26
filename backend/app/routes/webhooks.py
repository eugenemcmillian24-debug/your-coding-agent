import logging
from fastapi import APIRouter, Request, HTTPException
from ..services.webhooks import verify_github_signature, verify_cloudflare_signature, record_webhook_event

router = APIRouter()
logger = logging.getLogger("forge_agent.routes.webhooks")


@router.post("/github")
async def github_webhook(request: Request):
    """Receive and verify GitHub webhook events."""
    body = await request.body()
    headers = dict(request.headers)
    try:
        verify_github_signature(headers, body)
        verified = True
    except Exception as e:
        logger.warning("GitHub webhook verification failed: %s", e)
        raise HTTPException(status_code=403, detail=str(e))
    payload = await request.json()
    record_webhook_event("github", headers.get("x-github-event", ""), headers.get("x-github-delivery", ""), payload, verified)
    return {"ok": True, "verified": verified}


@router.post("/cloudflare")
async def cloudflare_webhook(request: Request):
    """Receive and verify Cloudflare Pages webhook events."""
    body = await request.body()
    headers = dict(request.headers)
    try:
        verify_cloudflare_signature(headers, body)
        verified = True
    except Exception as e:
        logger.warning("Cloudflare webhook verification failed: %s", e)
        raise HTTPException(status_code=403, detail=str(e))
    payload = await request.json()
    record_webhook_event("cloudflare", payload.get("event", ""), payload.get("id", ""), payload, verified)
    return {"ok": True, "verified": verified}
