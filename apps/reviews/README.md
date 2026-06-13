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

Wix needs to reach your OAuth callback and webhook endpoints. For local dev, use a tunnel:

```bash
# pick one
ngrok http 3000
cloudflared tunnel --url http://localhost:3000
```

Then in the Wix Dev Center, set:
- **Redirect URL** → `https://<your-tunnel>/api/wix/install`
- **Webhook URL** → `https://<your-tunnel>/api/wix/webhook`

See `../../docs/02_wix_developer_center_setup.md` for the full registration checklist.

## Key Paths

| Path | Purpose |
|---|---|
| `app/page.tsx` | Dashboard root (embedded in Wix iframe) |
| `app/api/wix/install/route.ts` | OAuth callback — runs on app install |
| `app/api/wix/webhook/route.ts` | Webhook fanout (Order Fulfilled, Payment Status Updated, etc.) |
| `app/api/public/review/[token]/route.ts` | Public review submission form API |
| `app/api/widget/products/[productId]/route.ts` | Storefront widget data endpoint |
| `drizzle/schema.ts` | Database schema (see spec §4) |
| `lib/db.ts` | Drizzle client (Neon HTTP driver) |
| `lib/env.ts` | zod-validated env access |
| `lib/wix/oauth.ts` | Wix OAuth token exchange |
| `lib/wix/webhooks.ts` | Wix webhook signature verification |
| `lib/wix/client.ts` | Wix REST API client wrapper |

## Status

`spec` → **`building`** (scaffold complete, MVP work begins per week-by-week plan in spec §7).
