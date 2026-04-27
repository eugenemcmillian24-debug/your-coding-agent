import base64
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field

from ..services.invoice_service import generate_invoice, get_credits_used_this_month
from ..services.subscription import check_subscription
from ..services.db import get_conn

router = APIRouter()
logger = logging.getLogger("forge_agent.invoice_routes")


class InvoiceRequest(BaseModel):
    email: EmailStr
    input_text: str = Field(..., min_length=10, max_length=10000,
                            description="Free-form client/project info for the invoice")
    model: str | None = Field(None, max_length=50, description="AI model override")


class InvoiceResponse(BaseModel):
    invoice_id: str
    invoice_data: dict
    pdf_base64: str
    credits_remaining: int | str


@router.post("/generate", response_model=InvoiceResponse)
async def create_invoice(payload: InvoiceRequest):
    """Generate an AI-powered invoice PDF.

    Requires an active subscription. Deducts 1 credit per generation.
    """
    sub = check_subscription(payload.email)
    if not sub.get("subscribed"):
        raise HTTPException(status_code=403, detail="Active subscription required")

    builds_limit = sub.get("builds_remaining", 0)
    if builds_limit == 0:
        raise HTTPException(status_code=403, detail="No credits remaining this month")

    try:
        invoice_id, invoice_data, pdf_bytes = await generate_invoice(
            user_email=payload.email,
            raw_input=payload.input_text,
            model_id=payload.model,
        )
    except Exception as e:
        logger.error("Invoice generation failed for %s: %s", payload.email, e)
        raise HTTPException(status_code=500, detail=f"Invoice generation failed: {e}")

    used = get_credits_used_this_month(payload.email)
    if builds_limit == -1:
        remaining: int | str = "unlimited"
    else:
        remaining = max(0, builds_limit - used)

    return InvoiceResponse(
        invoice_id=invoice_id,
        invoice_data=invoice_data,
        pdf_base64=base64.b64encode(pdf_bytes).decode(),
        credits_remaining=remaining,
    )


@router.get("/credits/{email}")
def get_credits(email: str):
    """Check invoice generation credits for a user."""
    sub = check_subscription(email)
    if not sub.get("subscribed"):
        return {"credits_remaining": 0, "credits_used": 0, "subscribed": False}

    used = get_credits_used_this_month(email)
    builds_limit = sub.get("builds_remaining", 0)

    if builds_limit == -1:
        return {"credits_remaining": "unlimited", "credits_used": used, "subscribed": True}

    return {
        "credits_remaining": max(0, builds_limit - used),
        "credits_used": used,
        "subscribed": True,
    }


@router.get("/{invoice_id}/download")
def download_invoice(invoice_id: str):
    """Download a previously generated invoice PDF."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT pdf_bytes, invoice_data FROM invoice_generations WHERE id = %s",
            (invoice_id,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")

    data = dict(row)
    invoice_data = data.get("invoice_data", {})
    inv_num = invoice_data.get("invoice_number", invoice_id[:8]) if isinstance(invoice_data, dict) else invoice_id[:8]
    filename = f"invoice-{inv_num}.pdf"

    return Response(
        content=bytes(data["pdf_bytes"]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
