import os
import logging
import stripe

logger = logging.getLogger("forge_agent.stripe")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

# Plan catalog — maps tier slugs to Stripe price IDs and limits
PLANS = {
    "basic": {
        "price_id": "price_1TQRCmCAKXYgQRl591AfcZ3W",
        "name": "Basic",
        "amount": 399,
        "builds_per_month": 5,
        "features": ["5 builds per month", "Free AI models only", "Community support"],
        "models": ["free"],
    },
    "starter": {
        "price_id": "price_1TQRCmCAKXYgQRl5faj6Y5Cl",
        "name": "Starter",
        "amount": 999,
        "builds_per_month": 25,
        "features": ["25 builds per month", "Free + Go plan models", "Priority queue", "Email support"],
        "models": ["free", "go"],
    },
    "pro": {
        "price_id": "price_1TQRCmCAKXYgQRl5rSMK0p0l",
        "name": "Pro",
        "amount": 1999,
        "builds_per_month": -1,  # unlimited
        "features": ["Unlimited builds", "All AI models", "Custom deployment targets", "Priority support", "Team collaboration"],
        "models": ["free", "go", "zen"],
    },
    "premium": {
        "price_id": "price_1TQRCmCAKXYgQRl5kr4abARn",
        "name": "Premium",
        "amount": 4999,
        "builds_per_month": -1,  # unlimited
        "features": ["Everything in Pro", "White-label branding", "Custom domain deployments", "Dedicated support", "API access", "SLA guarantee"],
        "models": ["free", "go", "zen"],
    },
}


def get_plan(tier: str) -> dict | None:
    return PLANS.get(tier)


def create_checkout_session(
    tier: str,
    customer_email: str,
    success_url: str,
    cancel_url: str,
    user_id: str | None = None,
) -> str:
    """Create a Stripe Checkout Session and return the URL."""
    plan = PLANS.get(tier)
    if not plan:
        raise ValueError(f"Unknown plan tier: {tier}")

    metadata = {"tier": tier}
    if user_id:
        metadata["user_id"] = user_id

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": plan["price_id"], "quantity": 1}],
        customer_email=customer_email,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        subscription_data={"metadata": metadata},
    )
    return session.url


def create_billing_portal_session(customer_id: str, return_url: str) -> str:
    """Create a Stripe Billing Portal session for managing subscriptions."""
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return session.url


def verify_webhook(payload: bytes, sig_header: str) -> dict:
    """Verify and parse a Stripe webhook event."""
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    return event


def get_subscription(subscription_id: str) -> dict:
    """Retrieve a Stripe subscription."""
    return stripe.Subscription.retrieve(subscription_id)


def cancel_subscription(subscription_id: str) -> dict:
    """Cancel a subscription at period end."""
    return stripe.Subscription.modify(
        subscription_id,
        cancel_at_period_end=True,
    )
