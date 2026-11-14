# AGENTS.md — wix-apps (Bodham Labs)

> Read this file first. Works for Claude Code, OpenAI Codex, Google Antigravity and any agent that follows the AGENTS.md convention. `CLAUDE.md` is a thin pointer to this file.

---

## 0. Bodham Labs module kit (read first)

*What this is:* where everything about this project lives. *Why:* any session, on any device, can pick the work up cold. *What you get:* the links and the rules that must not break.

| Piece | Where |
|---|---|
| Handoff doc (status, founder steps, next task, last HANDOFF block) | Bodhamlabs claude.ai project → `projects/wix-reviews-app-handoff.md` |
| Company map and company-wide decisions (HQ writes them) | Same project → `claude/projects-map.md`, `claude/decisions.md`; open notices in `claude/notices/` |
| This repo's decisions | `docs/decisions.md` |
| Progress per version | `CHANGELOG.md`; task-level progress at the top of `docs/02_reviews_mvp_tasks.md` |
| App context (what is where, commands) | `apps/reviews/AGENTS.md` |
| Known traps | `docs/GOTCHAS.md` (read in full before work) |
| Scope, plans, roadmap | `docs/01_reviews_app_prd_v2.md`, `docs/03_reviews_roadmap.md` |
| Code home | GitHub `Prabhu0077/wix-apps` (public); founder's PC `D:\wix` (moves to `D:\BodhamLabs\products\` when HQ does it) |

**Department:** Products. **Status:** pre-launch — MVP built and tested with mocked APIs; not deployed from `feat/mvp-revamp`; not run on a live Wix store.

**Rules that must not break**
1. Work only on this project. Don't edit Bodham Labs HQ files or another project's files; ask HQ through a HANDOFF block.
2. Never commit secrets. Run gitleaks before every push. Never print or read out `.env.local` values (use `node --env-file=.env.local` scripts that print no values).
3. Push only with the founder's OK. Production database migrations and publishing the test store need the founder's explicit yes.
4. No rating gating, ever (see `docs/decisions.md`). Never show a feature as available that isn't built.
5. Claude never types passwords or login codes, creates accounts or changes security settings; it prepares the step and hands the founder an exact instruction.
6. Accounts are split: the Wix app and test store are on the company email (prabhakar.chandra@bodhamlabs.com); Vercel and GitHub are on the founder's personal Gmail. Check which account is signed in before changing a setting.
7. Don't move, rename or delete project folders; HQ does folder moves.
8. End every work phase with a HANDOFF block (format in §9) and update the handoff doc.

---

## 1. North Star

This repo is a **portfolio of Wix App Market apps** made by Bodham Labs (founder: Prabhakar). The motto is **earn through the apps** — recurring revenue, not vanity launches. App #1 is **Product Reviews** (public name not decided; `apps/reviews/lib/product.ts`).

## 2. Current focus

Launch Product Reviews: deploy (Vercel Git integration), register the site plugins and widgets on the Wix app, live test on the "Bodham Test Store", then App Market submission. Steps and owners are in the handoff doc. Other app ideas: `docs/Wix_Apps_Portfolio.md` (strategy tracker; its decisions log is history — new decisions go in `docs/decisions.md`).

## 3. Architecture rules — read before adding abstractions

1. **Monorepo with pnpm workspaces + Turborepo.** `apps/*` for products, `packages/*` for shared code.
2. **`packages/` is EMPTY until app #2 forces an extraction.** Duplication for two months is cheaper than the wrong abstraction for two years.
3. **Within each app, keep clean module boundaries** (`lib/wix/`, `lib/email/`, `lib/media/`, `lib/db.ts` …). When app #2 needs the exact same code, move that folder to `packages/X/` and add tests there.
4. **Don't share dashboards across apps.** Share design tokens later, not screens.
5. **Each app gets its own Postgres schema** (`reviews` for app #1).

If you think an abstraction is worth extracting before app #2 exists, **stop and ask the founder**.

## 4. Stack (change only with the founder's agreement and a row in `docs/decisions.md`)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node 20+, Next.js 15 (App Router) | One Next.js app per product |
| Language | TypeScript 5, strict | No `any` without a comment saying why |
| Packages / build | pnpm workspaces, Turborepo | Lockfile `pnpm-lock.yaml` |
| Database | Neon Postgres, schema per app | Driver `@neondatabase/serverless` |
| ORM | Drizzle + drizzle-kit | Never Prisma |
| Wix auth | OAuth client credentials (App ID + secret → token per site, encrypted) | Installs arrive by the App Installed webhook |
| Storefront | Custom elements (`public/elements/reviews.js`, built by esbuild) loading `/widget*` pages | New Wix apps can't use iframe widgets |
| Email | Zoho ZeptoMail (Resend fallback), `lib/email/transport.ts` | Sending domain bodhamlabs.com |
| Media | Cloudflare R2, signed URLs | Not switched on yet |
| Hosting + jobs | Vercel; two daily Vercel crons (`apps/reviews/vercel.json`) | Project `reviews`, team "prabhu0077's projects" |
| SMS, observability | Planned (Growth plan; Sentry / PostHog later) | Not in use; `twilio` is still a dependency |

## 5. Repo layout

```
wix-apps/
├── AGENTS.md            ← you are here
├── CLAUDE.md            pointer to AGENTS.md
├── CHANGELOG.md         progress per version
├── docs/
│   ├── decisions.md                 decision log (module standard)
│   ├── GOTCHAS.md                   known traps — read before work
│   ├── 01_reviews_app_prd_v2.md     scope and plans (current)
│   ├── 02_reviews_mvp_tasks.md      task list, progress at the top
│   ├── 03_reviews_roadmap.md        Fera comparison, plan ladder, phases
│   ├── 02_wix_developer_center_setup.md, 01_visual_ugc_reviews_mvp_spec.md, PROGRESS.md   history
│   └── Wix_Apps_Portfolio.md, Wix_App_Opportunities_2026.docx   portfolio strategy
├── apps/reviews/        app #1 (own AGENTS.md)
├── packages/            empty until app #2
└── scripts/sync-docs.ps1   mirrors docs/ to a Google Drive folder
```

## 6. How to run and test

From `apps/reviews` (details and Windows notes in `apps/reviews/AGENTS.md` and `docs/GOTCHAS.md`):

- `pnpm install` (if the lockfile complains on the PC: `--no-frozen-lockfile`)
- `pnpm test` — core, import, features and auth tests; no database or network
- `pnpm typecheck` — delete `.next` first if it complains about `.next/types`
- `pnpm build` — builds `public/elements/reviews.js`, then Next.js
- `pnpm dev` — local server on port 3000; fake webhooks with `node scripts/post-test-webhook.mjs --instance <id>` and `WIX_WEBHOOK_DEV_BYPASS=1`

Env var names: `.env.example` (root) and `apps/reviews/lib/env.ts`. Real values only in `apps/reviews/.env.local` (gitignored) and Vercel.

## 7. Coding conventions

- TypeScript strict; use `unknown` and narrow. Absolute imports `@/lib/...`.
- Prettier + ESLint (`pnpm fmt`). `camelCase` / `PascalCase` / `SCREAMING_SNAKE` for env vars.
- `async/await`; handle errors at a boundary (route, cron); never swallow silently.
- Drizzle query builder; raw SQL only with a comment saying why.
- Webhooks: verify the signature before any side effect; reply in under 1 s, heavy work after the response.
- Comments explain *why*, not *what*.

## 8. Living knowledge

- **`docs/decisions.md`** — add a row on top for every non-trivial decision.
- **`CHANGELOG.md`** — add a line for every batch of work.
- **`docs/GOTCHAS.md`** — read in full before work; after any non-obvious fix add `## YYYY-MM-DD — <title>` with 2–4 sentences and *(Hit by: …)* on top.

## 9. Hand-off between sessions and agents

1. Commit finished work (push only with the founder's OK).
2. Update `CHANGELOG.md`, `docs/decisions.md`, `docs/GOTCHAS.md` as needed.
3. End with a HANDOFF block and put it in the handoff doc:
   ```
   HANDOFF — Wix reviews app — <date>
   Done: … | Decisions (with why): … | Open questions for the founder: … | Next step: … | Files changed / commits: …
   ```
4. The next agent reads: this file → `docs/GOTCHAS.md` → `docs/decisions.md` → the handoff doc → `apps/reviews/AGENTS.md`.

## 10. What NOT to do

- Don't build a shared package before app #2 exists.
- Don't switch the ORM, database host or package manager without the founder.
- Don't add a dependency without checking bundle size (webhook routes and `reviews.js` must stay small).
- Don't commit `node_modules/`, `.next/`, `.env*` (except `.env.example`), `scratch/`, `shots/` or media files.
- Don't write fluffy comments or AI-style preambles.

## 11. Useful links

- Wix developer docs: https://dev.wix.com/docs
- Wix App Market billing: https://dev.wix.com/docs/build-apps/launch-your-app/pricing-and-billing/about-monetizing-your-app
- Neon: https://neon.tech · Drizzle: https://orm.drizzle.team · Turborepo: https://turbo.build/repo · Cloudflare R2: https://developers.cloudflare.com/r2/

---

*Last updated: 2026-10-15 (Bodham Labs module kit). Maintainer: Prabhakar / Bodham Labs.*
