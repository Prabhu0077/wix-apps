# AGENTS.md — apps/reviews

App-specific context. Read the **root `AGENTS.md`** first, then `../../docs/01_visual_ugc_reviews_mvp_spec.md`, then this file.

---

## What this app is

Visual UGC & Video Reviews for Wix Stores. App #1 in the portfolio. Build target: 6–8 weeks. See spec §7 for the week-by-week plan.

## Current state (scaffold)

Working Next.js 15 shell with Drizzle + Neon wired up. The following exist as **functional stubs** — they boot and respond, but return TODO placeholders:

- `app/api/wix/install/route.ts` — OAuth code-exchange works; gets site properties and inserts/updates accounts on installation.
- `app/api/wix/webhook/route.ts` — receives + parses payloads; signature verification is fully implemented with jose JWS verification and body SHA-256 matching (with a fallback dev-bypass in development); event handlers are TODOs.
- `app/api/public/review/[token]/route.ts` — accepts GET/POST; no real lookup or persistence yet.
- `app/api/widget/products/[productId]/route.ts` — returns an empty review list.
- All dashboard pages (`app/page.tsx`, `app/reviews/page.tsx`, etc.) render a placeholder; no real data fetching yet.
- `lib/wix/client.ts` — minimal REST helper; expand as more endpoints are needed.
- `drizzle/schema.ts` — complete per spec §4. Run `pnpm db:generate && pnpm db:migrate` to apply.

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

- **Webhook signature verification is implemented** in `lib/wix/webhooks.ts` using `jose` to verify the JWS signature from the `digest` header and validate the body payload hash. Production strictly blocks invalid signatures, while development logs a warning but allows processing for local development convenience.
- **Public review tokens** are random and high-entropy (`createId()` from cuid2). Don't expose internal IDs in URLs.
- **Media uploads** go directly to R2 via signed URLs — the server doesn't proxy bytes. Validate file size and MIME server-side before issuing the signed URL.

## When you change something here

- If you change `drizzle/schema.ts`, also update spec §4 in `../../docs/01_visual_ugc_reviews_mvp_spec.md`.
- If you change OAuth scopes or webhook subscriptions, also update `../../docs/02_wix_developer_center_setup.md` so the Dev Center registration stays in sync.
- If you make an architectural decision (e.g., switch from Vercel Cron to a Railway worker), add a row to the Decisions Log in `../../docs/Wix_Apps_Portfolio.md`.

## What NOT to do

- ❌ Don't add `prisma/`, drop in Prisma, or import `@prisma/client`. Drizzle only.
- ❌ Don't import directly from another app under `apps/*`. If you need shared code, talk to the user about extraction.
- ❌ Don't read `process.env.X` outside `lib/env.ts`.
- ❌ Don't write to `node_modules`, `.next/`, or commit `.env.local`.
- ❌ Don't introduce a new third-party UI library without justification — plain React + CSS modules for v1.

---

*Last updated: 2026-05-21.*
