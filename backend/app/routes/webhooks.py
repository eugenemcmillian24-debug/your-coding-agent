from fastapi import APIRouter, Request, HTTPException
from ..services.webhooks import verify_github_signature, verify_vercel_signature, record_webhook_event
router = APIRouter()
@router.post('/github')
async def github_webhook(request: Request):
    body = await request.body()
    headers = dict(request.headers)
    try:
        verify_github_signature(headers, body)
        verified = True
    except Exception as e:
        verified = False
        raise HTTPException(status_code=403, detail=str(e))
    payload = await request.json()
    record_webhook_event('github', headers.get('x-github-event', ''), headers.get('x-github-delivery', ''), payload, verified)
    return {'ok': True, 'verified': verified}
@router.post('/vercel')
async def vercel_webhook(request: Request):
    body = await request.body()
    headers = dict(request.headers)
    try:
        verify_vercel_signature(headers, body)
        verified = True
    except Exception as e:
        verified = False
        raise HTTPException(status_code=403, detail=str(e))
    payload = await request.json()
    record_webhook_event('vercel', headers.get('x-vercel-event', ''), headers.get('x-vercel-id', ''), payload, verified)
    return {'ok': True, 'verified': verified}
