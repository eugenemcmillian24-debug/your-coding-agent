# Stripe Integration and Admin Free Access Fixes

## Overview

This document summarizes the fixes applied to resolve Railway deployment failures related to Stripe integration and admin free access features.

## Problems Identified

1. **Missing `subscriptions` table**: The Stripe integration code referenced a `subscriptions` table that was never created in the database initialization, causing SQL errors when accessing Stripe endpoints.

2. **Missing environment variables**: The `.env.example` and Railway documentation did not include the required Stripe and admin configuration environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `ADMIN_EMAILS`
   - `FRONTEND_URL`

3. **Incomplete documentation**: Railway setup guides and README did not mention Stripe configuration or admin free access features.

## Solutions Implemented

### 1. Database Schema Fix (`backend/app/services/db.py`)

Added the `subscriptions` table to the `init_db()` function:

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    customer_id TEXT,
    customer_email TEXT NOT NULL UNIQUE,
    subscription_id TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL DEFAULT 'basic',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

With indexes for performance:
- `idx_subscriptions_customer_email`
- `idx_subscriptions_subscription_id`

### 2. Environment Variables Updated (`backend/.env.example`)

Added the following environment variables:

```bash
# Stripe Integration (required for subscription management)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin Configuration
# Comma-separated list of admin emails that get free unlimited access
ADMIN_EMAILS=admin@example.com,owner@example.com

# Frontend
FRONTEND_URL=http://localhost:3000
```

### 3. Documentation Updates

#### `RAILWAY_SETUP.md`
- Added Stripe and admin environment variables to the required list
- Updated example commands to include new variables
- Added `FRONTEND_URL` for Stripe redirects

#### `RAILWAY_FIXES.md`
- Added Stripe integration section with:
  - Feature descriptions (subscription tiers, admin free access, webhooks)
  - Database schema documentation
  - Admin configuration instructions
- Updated testing section to verify Stripe endpoints
- Added Stripe-specific troubleshooting tips

#### `RAILWAY_DEPLOYMENT_FIX.md`
- Added Stripe and admin variables to required environment variables list

#### `README.md`
- Added Stripe and admin variables to environment variables table
- Added Stripe Setup section with step-by-step instructions
- Added Stripe API endpoints to API Reference section

## Features Enabled

### Subscription Management
- **Basic**: 5 builds/month, free models only
- **Starter**: 25 builds/month, free + go models
- **Pro**: Unlimited builds, all models
- **Premium**: Unlimited builds, all models + additional features

### Admin Free Access
Admins (emails in `ADMIN_EMAILS`) receive:
- Unlimited builds (`builds_per_month: -1`)
- Premium tier access
- All available models (free, go, zen)
- Bypass Stripe subscription checks

### Webhook Support
Handles Stripe events:
- `checkout.session.completed` - Creates new subscription
- `customer.subscription.updated` - Updates subscription tier/status
- `customer.subscription.deleted` - Marks subscription as canceled
- `invoice.payment_failed` - Marks subscription as past_due

## Verification Steps

After deployment, verify:

1. **Database initialization**:
   ```bash
   railway logs --service backend | grep "Database tables initialized"
   ```

2. **Stripe endpoints**:
   ```bash
   curl https://your-backend.railway.app/api/stripe/plans
   ```

3. **Admin access**:
   ```bash
   curl https://your-backend.railway.app/api/stripe/subscription/admin@example.com
   ```
   Should return `is_admin: true` with unlimited builds.

4. **Webhook verification**:
   - Test webhook in Stripe dashboard
   - Check logs for "Stripe webhook: checkout.session.completed"

## Environment Variable Summary

### Required for Production
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `ADMIN_EMAILS` - Comma-separated admin emails
- `FRONTEND_URL` - Frontend URL for Stripe redirects

### Optional
- Admin emails can be empty if no free access is needed
- For testing, use Stripe test keys (`sk_test_`, `whsec_test_`)

## Deployment Checklist

- [ ] Set `STRIPE_SECRET_KEY` in Railway
- [ ] Set `STRIPE_WEBHOOK_SECRET` in Railway
- [ ] Set `ADMIN_EMAILS` in Railway (if using admin free access)
- [ ] Set `FRONTEND_URL` in Railway
- [ ] Create Stripe webhook pointing to `/api/webhooks/stripe`
- [ ] Configure Stripe products/prices for each tier
- [ ] Verify `subscriptions` table is created on startup
- [ ] Test admin access endpoint
- [ ] Test subscription checkout flow
- [ ] Verify webhook events are received and processed

## Notes

- The `subscriptions` table is automatically created on application startup
- Admin emails are case-insensitive (converted to lowercase for comparison)
- Stripe webhook verification is required for security
- Admin users bypass all Stripe subscription checks
- Subscription status is tracked: active, canceled, past_due, trialing
