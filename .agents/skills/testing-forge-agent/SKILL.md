# Testing Forge Agent — Auth, Stripe & E2E Flows

## Overview
Forge Agent is a Next.js frontend (static export on Cloudflare Pages) with a FastAPI backend (Railway). Auth uses Supabase email+password. Subscriptions use Stripe.

## Devin Secrets Needed
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin key (for creating test users)
- `STRIPE_SECRET_KEY` — Stripe secret key
- `CLOUDFLARE_API_TOKEN` — Cloudflare Pages deploy token
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

## Environment URLs
- **Frontend:** https://your-coding-agent.pages.dev
- **Backend:** https://backend-production-68287.up.railway.app
- **Health check:** `GET /api/health` → `{"ok": true, "version": "..."}`

## Pre-Test Setup

### 1. Verify environments are reachable
```bash
curl -s https://your-coding-agent.pages.dev | head -5
curl -s https://backend-production-68287.up.railway.app/api/health
```

### 2. Create test users via Supabase Admin API
Supabase may reject sign-up for emails that don't have a real mailbox (server-side email validation). To create test users reliably, use the Admin API:
```bash
curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@gmail.com",
    "password": "TestPass123!",
    "email_confirm": true
  }'
```

### 3. Verify admin bypass
```bash
curl -s https://backend-production-68287.up.railway.app/api/stripe/subscription/eugenemcmillian9@gmail.com
# Should return: {"subscribed": true, "tier": "premium", "is_admin": true}
```

## Auth Flow Testing

### Sign In Tab (default view)
- Email + Password fields, "Sign In" button
- Empty submit → "Email and password are required" (client-side)
- Wrong password → "Invalid login credentials" (from Supabase)
- Correct admin credentials → Builder view with red ADMIN badge
- Correct non-subscribed user → Pricing view with "Choose a plan to get started"

### Sign Up Tab
- Click "Sign Up" tab → shows Confirm Password field, button changes to "Create Account"
- Password mismatch → "Passwords do not match" (client-side, no API call)
- Password < 6 chars → "Password must be at least 6 characters" (client-side)
- Supabase may reject emails with non-existent mailboxes — use Admin API to create test users instead

### Sign Out
- Button visible on all authenticated views (pricing and builder)
- Clears Supabase session, returns to auth screen

### Session Persistence
- After sign-in, F5 refresh should preserve the session
- Supabase stores tokens in localStorage automatically

## Subscription & Stripe Testing

### View Routing Logic
1. Not authenticated → Auth form (Sign In/Sign Up tabs) + marketing pricing below
2. Authenticated, not subscribed → Pricing page with "Choose a plan to get started"
3. Authenticated, subscribed or admin → Builder view

### Admin Bypass
- Admin email: `eugenemcmillian9@gmail.com` (configured via `ADMIN_EMAILS` env var on Railway backend)
- Gets `is_admin: true, tier: premium` from subscription check
- Shows red "ADMIN" badge, no "Manage Plan" button

### Stripe Checkout
- Click any "Get [Tier]" button while signed in → redirects to `checkout.stripe.com`
- Checkout page shows plan name, price, user email pre-filled
- After successful payment, redirects back with `?checkout=success` which triggers builder view

### Verify Plans API
```bash
curl -s https://backend-production-68287.up.railway.app/api/stripe/plans | python3 -m json.tool
# Returns 4 tiers: basic ($3.99), starter ($9.99), pro ($19.99), premium ($49.99)
```

## Frontend Deployment
The frontend is a Next.js static export deployed to Cloudflare Pages:
```bash
cd frontend
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
NEXT_PUBLIC_API_BASE="https://backend-production-68287.up.railway.app" \
npx next build

CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
npx wrangler pages deploy out --project-name your-coding-agent --branch main
```

## Common Issues
- **Sign-up rejects test emails**: Supabase validates email domains. Use Admin API to create test users.
- **Backend returns 404 for subscription**: Ensure the backend is deployed from latest `main` with all env vars set.
- **CORS errors**: Backend `FRONTEND_URL` env var must be set to `https://your-coding-agent.pages.dev`.
- **Admin bypass not working**: `ADMIN_EMAILS` must be set on Railway backend env vars.
- **Railway healthcheck failures**: The backend service should NOT have an HTTP healthcheck configured (it was removed in PR #17).
