# AGENTS.md — apps/reviews

App-specific context. Read the **root `AGENTS.md`** first, then `../../docs/01_reviews_app_prd_v2.md`, then this file. (`01_visual_ugc_reviews_mvp_spec.md` is history.)

---

## What this app is

"Product Reviews" for Wix Stores, made by Bodham Labs (public name still open — change `lib/product.ts`). App #1 in the portfolio. Scope and plans: `../../docs/01_reviews_app_prd_v2.md`. Task list with progress at the top: `../../docs/02_reviews_mvp_tasks.md`. Roadmap, plan ladder and Fera comparison: `../../docs/03_reviews_roadmap.md`. Which plan unlocks which feature: `lib/features.ts` (one table). Known traps: `../../docs/GOTCHAS.md`.

## Current state (MVP code complete, 14 Oct 2026; not yet run against a live Wix store)

| Area | Where |
|---|---|
| Order fulfilled → review request (monthly plan limit, unsubscribe list, dedupe per order) | `app/api/wix/webhook/route.ts`, `lib/usage.ts`, `lib/plans.ts`, `lib/suppression.ts` |
| Sending emails (retries, store name + postal address, one-click unsubscribe headers) | `app/api/cron/send-requests/route.ts`, `lib/email/review-request.tsx`, `lib/store-profile.ts`, `lib/wix/site.ts` |
| Review form (one block per product, photos to R2 when configured) | `app/(public)/review/[token]/`, `app/api/public/review/` |
| Storefront widget — plain server-rendered HTML, ~1 KB of JS | `app/(embed)/widget/route.ts`, `lib/widget-html.ts`, `lib/widget-data.ts` |
| Dashboard: Overview (setup check, usage), Reviews (filters, import, export), Settings (+ review policy text), Plan | `app/(dashboard)/`, `components/dashboard/` |
| Catalog V1 + V3 product reads | `lib/wix/catalog.ts` (only place that calls Stores product APIs) |
| Import (CSV, Wix Reviews) and export (CSV) | `app/api/reviews/import/`, `app/api/reviews/export/`, `lib/import*.ts`, `lib/product-match.ts` |
| Uninstall → 30-day deletion | webhook `AppRemoved`, `app/api/cron/purge-uninstalled/route.ts` |
| Help, privacy, terms, unsubscribe pages | `app/(public)/` |

Commands (from this folder; on the founder's PC see GOTCHAS for `NODE_ENV`):

- `pnpm test` — pure-logic tests (`tests/`), no database or network.
- `node_modules\.bin\tsc.cmd --noEmit` — type-check (delete `.next` first if it complains about `.next/types`).
- `node scripts/post-test-webhook.mjs --instance <id>` — post a fake order-fulfilled webhook to a local dev server running with `WIX_WEBHOOK_DEV_BYPASS=1`.
- Migrations: edit `drizzle/schema.ts` → `drizzle-kit generate` (works offline with a dummy `DATABASE_URL`) → read-only check of `drizzle.__drizzle_migrations` → `node --env-file=.env.local node_modules\drizzle-kit\bin.cjs migrate` with the founder's yes.

## Module boundaries (do not blur)

`lib/` folders are **extraction candidates** for `packages/*` when app #2 arrives. Keep each folder self-contained — no cross-imports between `lib/wix/` and `lib/billing/`, etc. If you need a helper used by two `lib/X/` folders, put it in `lib/shared/` (or duplicate it; duplication is cheap).

| Folder | Owns | Don't put here |
|---|---|---|
| `lib/wix/` | OAuth, REST/SDK client, webhook signature, Wix-specific types | Business logic, DB queries |
| `lib/billing/` | Plan-state lookup, upgrade/downgrade webhook handling | UI, email |
| `lib/media/` | R2 signed-URL generation, transcoding queue | Database |
| `lib/email/`, `lib/sms/` | Postmark / Twilio wrappers + templates | Cron logic, business rules |
| `lib/moderation/` | AI moderation (profanity/spam) | Storage |
| `lib/db.ts` | Drizzle client export | Query helpers (those live near the route or workflow) |
| `lib/env.ts` | zod-validated env access | Anything else |

## Conventions specific to this app

- **Webhook handlers must respond <1s.** Validate → enqueue work → respond 200. Heavy work (sending email, calling Wix APIs, moderating media) goes to a worker, not the route.
- **Use `db` from `lib/db.ts`.** Never instantiate Drizzle elsewhere.
- **Use `env` from `lib/env.ts`.** Never read `process.env.X` directly — env is validated once at boot and the rest of the app gets typed access.
- **Schema changes:** edit `drizzle/schema.ts` → `pnpm db:generate` → review the migration → commit both schema and migration files.
- **Public endpoints** (anything under `app/api/public/`) are unauthenticated. Treat all input as hostile. Always validate with zod before any DB write.
- **Cron workers** live under `app/api/cron/` (uses Vercel Cron) or as standalone Railway workers — TBD which we choose for the review-request sender. Default to Vercel Cron for v1.

## Security gotchas

- **Webhook verification** (`lib/wix/webhooks.ts`): Wix sends a JWT in the request body, verified with the app's public key (`jose`, RS256). Unsigned test payloads are accepted only with `WIX_WEBHOOK_DEV_BYPASS=1` outside production.
- **Public review tokens** are random and high-entropy (`createId()` from cuid2). Don't expose internal IDs in URLs.
- **Media uploads** go directly to R2 via signed URLs — the server doesn't proxy bytes. The signing route checks the token is an open review request, photos only, 10 MB max; the submit route accepts only keys under `reviews/<token>/`.
- **Review gating is not allowed**: never add a rule that treats ratings differently (FTC, UK DMCC, Google). Auto-publish applies to every rating.
- **Shopper text is hostile**: escape it in HTML (`lib/widget-html.ts`, emails) and guard CSV exports against formulas (`lib/csv.ts`).

## When you change something here

- If you change `drizzle/schema.ts`, generate a migration and note it in `../../docs/02_reviews_mvp_tasks.md`.
- If you change OAuth scopes or webhook subscriptions, also update `../../docs/02_wix_developer_center_setup.md` so the Dev Center registration stays in sync.
- If you make an architectural decision (e.g., switch from Vercel Cron to a Railway worker), add a row to the Decisions Log in `../../docs/Wix_Apps_Portfolio.md`.

## What NOT to do

- ❌ Don't add `prisma/`, drop in Prisma, or import `@prisma/client`. Drizzle only.
- ❌ Don't import directly from another app under `apps/*`. If you need shared code, talk to the user about extraction.
- ❌ Don't read `process.env.X` outside `lib/env.ts`.
- ❌ Don't write to `node_modules`, `.next/`, or commit `.env.local`.
- ❌ Don't introduce a new third-party UI library without justification — plain React + plain CSS (`app/styles/`) for v1. The Wix Design System needs React 18, so it isn't used.
- ❌ Don't turn the storefront widget back into a React page: it loads on every product page and must stay under 30 KB.

---

*Last updated: 2026-10-14.*
