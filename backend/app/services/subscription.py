import logging
from ..services.db import get_conn
from ..services.stripe_service import PLANS

logger = logging.getLogger("forge_agent.subscription")


def check_subscription(email: str) -> dict:
    """Check if user has an active subscription and return plan details.
    
    Returns dict with: subscribed, tier, builds_remaining, allowed_models
    """
    if not email:
        return {"subscribed": False, "tier": None, "builds_remaining": 0, "allowed_models": []}

    with get_conn() as conn:
        # Get subscription
        sub_row = conn.execute(
            """SELECT tier, status FROM subscriptions 
               WHERE customer_email = %s AND status IN ('active', 'trialing')
               ORDER BY created_at DESC LIMIT 1""",
            (email,),
        ).fetchone()

        if not sub_row:
            return {"subscribed": False, "tier": None, "builds_remaining": 0, "allowed_models": []}

        sub = dict(sub_row)
        plan = PLANS.get(sub["tier"], {})
        builds_limit = plan.get("builds_per_month", 0)

        if builds_limit == -1:
            builds_remaining = -1  # unlimited
        else:
            # Count builds this month
            count_row = conn.execute(
                """SELECT COUNT(*) as cnt FROM jobs 
                   WHERE created_at >= date_trunc('month', NOW())
                   AND app_name IN (
                       SELECT app_name FROM jobs j2 
                       -- Link jobs to user by checking prompt or future user_id column
                   )""",
                # Simplified: in production, link jobs to users properly
            ).fetchone()
            used = dict(count_row)["cnt"] if count_row else 0
            builds_remaining = max(0, builds_limit - used)

        return {
            "subscribed": True,
            "tier": sub["tier"],
            "builds_remaining": builds_remaining,
            "allowed_models": plan.get("models", []),
        }


def can_use_model(tier: str, model_id: str) -> bool:
    """Check if a subscription tier allows using a specific model."""
    from ..services.provider_router import FREE_MODELS, ALL_MODELS

    plan = PLANS.get(tier)
    if not plan:
        return False

    allowed = plan.get("models", [])

    # Everyone can use free models
    if model_id in FREE_MODELS:
        return True

    # Go models need starter+
    if "go" in allowed:
        return True

    return False
