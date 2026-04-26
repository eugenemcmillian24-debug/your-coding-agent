import os
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from ..services.stripe_service import (
    PLANS, create_checkout_session, create_billing_portal_session,
    verify_webhook, get_subscription,
)
from ..services.db import get_conn

router = APIRouter()
logger = logging.getLogger("forge_agent.stripe_routes")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class CheckoutRequest(BaseModel):
    tier: str
    email: EmailStr


class PortalRequest(BaseModel):
    customer_id: str


@router.get("/plans")
def list_plans():
    """Return available subscription plans."""
    return [
        {
            "tier": tier,
            "name": plan["name"],
            "amount": plan["amount"],
            "currency": "usd",
            "builds_per_month": plan["builds_per_month"],
            "features": plan["features"],
            "models": plan["models"],
        }
        for tier, plan in PLANS.items()
    ]


@router.post("/checkout")
def create_checkout(payload: CheckoutRequest):
    """Create a Stripe Checkout session."""
    if payload.tier not in PLANS:
        raise HTTPException(status_code=400, detail=f"Unknown tier: {payload.tier}")

    try:
        url = create_checkout_session(
            tier=payload.tier,
            customer_email=payload.email,
            success_url=f"{FRONTEND_URL}?checkout=success",
            cancel_url=f"{FRONTEND_URL}?checkout=cancel",
        )
        return {"checkout_url": url}
    except Exception as e:
        logger.error("Checkout creation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


@router.post("/portal")
def create_portal(payload: PortalRequest):
    """Create a Stripe Billing Portal session."""
    try:
        url = create_billing_portal_session(
            customer_id=payload.customer_id,
            return_url=FRONTEND_URL,
        )
        return {"portal_url": url}
    except Exception as e:
        logger.error("Portal creation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create portal session")


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = verify_webhook(payload, sig_header)
    except Exception as e:
        logger.error("Webhook verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    logger.info("Stripe webhook: %s", event_type)

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(data)

    return {"received": True}


def _handle_checkout_completed(session: dict):
    """Process a completed checkout session."""
    customer_id = session.get("customer")
    customer_email = session.get("customer_email") or session.get("customer_details", {}).get("email")
    subscription_id = session.get("subscription")
    metadata = session.get("metadata", {})
    tier = metadata.get("tier", "basic")

    if not customer_email or not subscription_id:
        logger.warning("Checkout completed but missing email or subscription_id")
        return

    with get_conn() as conn:
        conn.execute(
            """INSERT INTO subscriptions
               (customer_id, customer_email, subscription_id, tier, status, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
               ON CONFLICT (customer_email) DO UPDATE SET
                 customer_id = EXCLUDED.customer_id,
                 subscription_id = EXCLUDED.subscription_id,
                 tier = EXCLUDED.tier,
                 status = EXCLUDED.status,
                 updated_at = NOW()""",
            (customer_id, customer_email, subscription_id, tier, "active"),
        )
    logger.info("Subscription activated: %s -> %s", customer_email, tier)


def _handle_subscription_updated(subscription: dict):
    """Handle subscription changes (upgrade/downgrade)."""
    subscription_id = subscription.get("id")
    status = subscription.get("status")
    metadata = subscription.get("metadata", {})
    tier = metadata.get("tier")

    update_fields = ["status = %s", "updated_at = NOW()"]
    update_values = [status]

    if tier:
        update_fields.append("tier = %s")
        update_values.append(tier)

    update_values.append(subscription_id)

    with get_conn() as conn:
        conn.execute(
            f"UPDATE subscriptions SET {', '.join(update_fields)} WHERE subscription_id = %s",
            tuple(update_values),
        )
    logger.info("Subscription updated: %s -> status=%s, tier=%s", subscription_id, status, tier)


def _handle_subscription_deleted(subscription: dict):
    """Handle subscription cancellation."""
    subscription_id = subscription.get("id")
    with get_conn() as conn:
        conn.execute(
            "UPDATE subscriptions SET status = %s, updated_at = NOW() WHERE subscription_id = %s",
            ("canceled", subscription_id),
        )
    logger.info("Subscription canceled: %s", subscription_id)


def _handle_payment_failed(invoice: dict):
    """Handle failed payment."""
    subscription_id = invoice.get("subscription")
    customer_email = invoice.get("customer_email")
    if subscription_id:
        with get_conn() as conn:
            conn.execute(
                "UPDATE subscriptions SET status = %s, updated_at = NOW() WHERE subscription_id = %s",
                ("past_due", subscription_id),
            )
    logger.warning("Payment failed for %s (sub: %s)", customer_email, subscription_id)


@router.get("/subscription/{email}")
def get_user_subscription(email: str):
    """Get subscription status for a user by email."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM subscriptions WHERE customer_email = %s AND status IN ('active', 'trialing', 'past_due') ORDER BY created_at DESC LIMIT 1",
            (email,),
        ).fetchone()
    if not row:
        return {"subscribed": False, "tier": None}
    sub = dict(row)
    plan = PLANS.get(sub["tier"], {})
    return {
        "subscribed": True,
        "tier": sub["tier"],
        "status": sub["status"],
        "customer_id": sub["customer_id"],
        "builds_per_month": plan.get("builds_per_month", 0),
        "models": plan.get("models", []),
    }
