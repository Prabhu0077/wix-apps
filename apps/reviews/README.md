# @wix-apps/reviews

Visual UGC & Video Reviews for Wix Stores — app #1 in the portfolio.

See `../../docs/01_visual_ugc_reviews_mvp_spec.md` for the full MVP spec and `AGENTS.md` for agent/dev conventions.

## Local Setup

1. From the monorepo root, install:
   ```bash
   pnpm install
   ```
2. Copy env and fill in values:
   ```bash
   cp .env.example .env.local
   ```
   Minimum required to boot: `DATABASE_URL`, `WIX_APP_ID`, `WIX_APP_SECRET`, `WIX_WEBHOOK_PUBLIC_KEY`.
3. Generate and apply migrations:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```
4. Run dev server:
   ```bash
   pnpm dev
   ```
   App boots on `http://localhost:3000`.

## Tunnel for Wix integration

Wix needs to reach your webhook endpoint, and the editor needs to load the storefront element script. For local dev, use a tunnel:

```bash
# pick one
ngrok http 3000
cloudflared tunnel --url http://localhost:3000
```

The app is registered in the Wix app dashboard (company account, Wix Studio workspace). New Wix apps use client-credentials OAuth: there is no Redirect URL. Set up there:
- **Webhooks** → `https://<host>/api/wix/webhook` for App Installed, App Removed, Fulfillment Status Updated (eCommerce)
- **Dashboard page** → iframe URL `https://<host>/`
- **Site plugin / widgets (Custom Element)** → script URL `https://<host>/elements/reviews.js`, tag names `bodham-product-reviews`, `bodham-rating-badge`, `bodham-reviews-carousel`, `bodham-all-reviews`

See `../../docs/GOTCHAS.md` (14 Oct entries) for permissions and env vars.

## Key Paths

| Path | Purpose |
|---|---|
| `app/page.tsx` | Dashboard root (embedded in Wix iframe) |
| `lib/wix/account.ts` | Creates the store's account on the App Installed webhook (or first dashboard open) |
| `elements/reviews-element.ts` | Storefront custom elements; built to `public/elements/reviews.js` |
| `app/api/widget/instance/route.ts` | Tells the storefront element which store it is on (Wix token → instanceId) |
| `app/api/wix/webhook/route.ts` | Webhook fanout (Order Fulfilled, Payment Status Updated, etc.) |
| `app/api/public/review/[token]/route.ts` | Public review submission form API |
| `app/api/widget/products/[productId]/route.ts` | Storefront widget data endpoint |
| `drizzle/schema.ts` | Database schema (see spec §4) |
| `lib/db.ts` | Drizzle client (Neon HTTP driver) |
| `lib/env.ts` | zod-validated env access |
| `lib/wix/oauth.ts` | Wix OAuth: app token per site (client credentials), token info |
| `lib/wix/webhooks.ts` | Wix webhook signature verification |
| `lib/wix/client.ts` | Wix REST API client wrapper |

## Status

`spec` → **`building`** (scaffold complete, MVP work begins per week-by-week plan in spec §7).
