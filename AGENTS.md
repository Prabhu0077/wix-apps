# AGENTS.md — Universal Agent Context

> Read this file first. Works for Claude Code, OpenAI Codex, Google Antigravity, and any other agent that follows the AGENTS.md convention. `CLAUDE.md` in this repo is a thin pointer to this file.

---

## 1. North Star

This repo (`D:\wix`) is a **portfolio of Wix App Market apps** owned by Prabhakar. The motto is **earn through the apps** — recurring revenue, not vanity launches. Prabhakar has prior experience shipping Shopify apps; this is the Wix expansion.

The detailed strategy, market research, and per-app specs live in `./docs/`. **Always read `docs/Wix_Apps_Portfolio.md` for current status before doing non-trivial work** — it's the source of truth for what's being built and where each app stands.

---

## 2. Current Sprint Focus

**App #1: Visual UGC & Video Reviews.** Full MVP spec at `docs/01_visual_ugc_reviews_mvp_spec.md`. Target: 6–8 weeks to public launch on the Wix App Market.

When working on app #1, code lives in `apps/reviews/`. Other apps will get their own folder under `apps/` later (see build sequence in `docs/Wix_Apps_Portfolio.md`).

---

## 3. Architecture Rules — Read Before Adding Abstractions

These rules exist to prevent premature abstraction, which is the #1 risk for a solo / small dev team building a portfolio.

1. **Monorepo with pnpm workspaces + Turborepo.** Folder structure is fixed: `apps/*` for products, `packages/*` for shared code.
2. **`packages/` is EMPTY until app #2 forces an extraction.** Do not create shared packages preemptively. Duplication for two months is cheaper than fighting the wrong abstraction for two years.
3. **Within each app, use clean module boundaries** (`lib/wix/`, `lib/billing/`, `lib/auth/`, `lib/media/`, `lib/email/`, `lib/sms/`, `lib/db.ts`). When app #2 needs the *exact same code*, that's the trigger to extract — move the folder to `packages/X/`, replace the duplicate, add tests at the package level.
4. **Do not share UI dashboards across apps** — each app's settings screens are too different. Share design tokens (Tailwind config) eventually, not screens.
5. **Each app gets its own Postgres schema.** Only shell models (Account, Site, Subscription, AuditLog) are candidates to share.

If you think you've found an abstraction worth extracting before app #2 exists, **stop and discuss with the user first**.

---

## 4. Locked Stack (do not change without the user agreeing)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node 20+ via Next.js 15 (App Router) | One Next.js app per product |
| Language | TypeScript 5.x, strict mode on | No `any` without an inline comment explaining why |
| Package manager | **pnpm** (workspaces) | Lockfile is `pnpm-lock.yaml` |
| Build orchestration | **Turborepo** | `turbo.json` at repo root |
| Database | **Neon Postgres** (one project, schema-per-app, branching for preview envs) | Driver: `@neondatabase/serverless` |
| ORM | **Drizzle** with `drizzle-kit` migrations | NOT Prisma — explicit choice for cold-start perf and SQL fluency |
| Media storage | **Cloudflare R2** (S3-compatible, zero egress) | Signed-URL uploads from clients |
| Transactional email | **Postmark** | Use verified merchant domains via DKIM where possible |
| Broadcast email | **Resend** | Marketing/digest emails only |
| SMS | **Twilio** | Pay-as-you-go |
| Auth (admin dashboards) | Wix OAuth for merchant install, no separate user auth | We are guests inside the merchant's Wix dashboard |
| Hosting | **Vercel** for Next.js apps, **Railway/Fly** for workers (cron + FFmpeg) | |
| Observability | Sentry + PostHog + BetterStack | One account, all apps |

---

## 5. Repo Layout

```
D:\wix\
├── AGENTS.md                       # ← you are here
├── CLAUDE.md                       # pointer to AGENTS.md (for Claude Code)
├── README.md                       # short public description
├── docs/                           # ALL strategy & planning docs
│   ├── Wix_App_Opportunities_2026.docx   # deep research report (10 ideas, gap matrix, scorecard)
│   ├── Wix_Apps_Portfolio.md             # LIVING TRACKER — status, decisions log, build sequence
│   └── 01_visual_ugc_reviews_mvp_spec.md # App #1 MVP spec (data model, week-by-week plan)
├── apps/                           # Each Wix app
│   └── reviews/                    # App #1: Visual UGC Reviews (to scaffold)
│       └── AGENTS.md               # App-specific agent context (created when app is scaffolded)
├── packages/                       # Empty until app #2 forces extraction
├── scripts/
│   └── sync-docs.ps1               # Mirror docs/ to a second local location (e.g. Google Drive)
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                    # Workspace root
├── .env.example
└── .gitignore
```

---

## 6. Coding Conventions

- **TypeScript strict mode.** No implicit `any`. Use `unknown` and narrow.
- **Imports:** alphabetized within groups (external → internal → relative); use absolute imports rooted at the app (`@/lib/...`).
- **Formatting:** Prettier defaults + ESLint with `@typescript-eslint/recommended`. Run `pnpm fmt` before commits.
- **Naming:** `camelCase` for variables/functions, `PascalCase` for types/components/classes, `SCREAMING_SNAKE` for env vars.
- **Files:** one default export per file when it's a component or a route; named exports otherwise.
- **Async:** prefer `async/await`. Never `.then()` chains. Always handle errors at a boundary (route handler, worker entry) — do not catch silently.
- **Database queries:** use Drizzle's query builder or relational queries. Raw SQL only with a comment explaining why.
- **Webhooks:** must validate signature before any side effect. Respond `200` in < 1s; queue the work if longer.
- **Comments:** explain *why*, not *what*. Code answers *what*.

---

## 7. Sensitive Data & Secrets

- **Never commit secrets.** Use `.env` locally (gitignored), Vercel env vars in prod.
- **`.env.example`** is the source of truth for what env vars are needed — keep it updated.
- Wix App secret keys, Postmark/Twilio/Stripe tokens, Neon connection strings: all secrets.
- Customer review media: stored in R2, accessed via signed URLs. Don't expose direct R2 keys publicly.

---

## 8. Living Knowledge: Tracker + Gotchas

Two short, append-on-top files carry the project's institutional memory across sessions and agents. **Read both before doing non-trivial work.** Updating them when you learn something is part of the work, not optional.

### 8a. Portfolio Tracker — `docs/Wix_Apps_Portfolio.md`

The **living source of truth** for what's being built and where each app stands. When you finish meaningful work, update:

- The **App Status Board** if status changed (`idea` → `spec` → `building` → `beta` → `live` → `growing`).
- The **Cross-Cutting Decisions Log** if any architecture decision was made (new entry at top, with date).

The detailed market research lives in `docs/Wix_App_Opportunities_2026.docx` — that's reference-only, rarely edited.

### 8b. Gotchas — `docs/GOTCHAS.md`

A short, single-file list of known traps in this repo: build errors with misleading signatures, sandbox quirks, security-sensitive bypasses, code paths that look optional but aren't. The whole point is to prevent every agent from re-discovering the same problem.

Two rules:

1. **Before starting work**, read `docs/GOTCHAS.md` in full. It is intentionally tiny.
2. **After fixing something non-obvious** — anything that took more than one wrong turn, anything where the failure mode was misleading, anything a different agent would also have tripped on — append a new entry on top of `docs/GOTCHAS.md`. Format: `## YYYY-MM-DD — <short title>` then 2–4 sentences (what, why it's misleading, the fix). Sign with `*(Hit by: <agent or human>.)*`.

If you didn't add to GOTCHAS, the next agent will trip on the same thing. That's the cost of skipping the rule.

---

## 9. Per-Agent Notes

### Claude Code
- `CLAUDE.md` is a thin file pointing here. Read this file as the project's primary context.
- The user's persistent memory (across Claude sessions) already knows the locked stack and current focus — but always verify against `docs/Wix_Apps_Portfolio.md` because memory can drift.

### OpenAI Codex (CLI or IDE)
- This file (`AGENTS.md`) is your project context. Codex reads it automatically at the repo root.
- For Wix API exploration, prefer the published Wix REST docs at <https://dev.wix.com/docs/api-reference/>.
- Codex doesn't have the Wix MCP that Claude has — fall back to docs.

### Google Antigravity
- This file (`AGENTS.md`) is your project context. Antigravity reads it at the repo root.
- For Wix API exploration, fall back to the published Wix REST docs.

### Hand-off between agents (daily-limit fallback)
When swapping agents mid-task:
1. The outgoing agent commits or saves all in-progress work.
2. The outgoing agent appends a short note to the **App Status Board** in `docs/Wix_Apps_Portfolio.md` describing where they stopped. If they hit a non-obvious problem and solved it, they also add an entry on top of `docs/GOTCHAS.md`.
3. The incoming agent reads in order: `AGENTS.md` → `docs/GOTCHAS.md` → `docs/Wix_Apps_Portfolio.md` → the relevant `docs/0X_*.md` spec.
4. The incoming agent picks up from the status note.

---

## 10. What NOT to Do

- ❌ Do not build a `packages/wix-sdk` (or any shared package) before app #2 exists.
- ❌ Do not switch the ORM, database host, or package manager without user approval.
- ❌ Do not introduce a new third-party dependency without checking bundle impact (webhook routes especially — they must be fast).
- ❌ Do not use Prisma anywhere. Drizzle only.
- ❌ Do not commit `node_modules/`, `.next/`, `.env`, or any media files.
- ❌ Do not modify the locked stack table in §4 without updating the Decisions Log in `docs/Wix_Apps_Portfolio.md` first.
- ❌ Do not write fluffy code comments or "AI-style" preambles to functions. Be terse.
- ❌ Do not start non-trivial work without reading `docs/GOTCHAS.md` first. It's tiny on purpose.

---

## 11. Useful Links

- Wix Developer docs: https://dev.wix.com/
- Wix App Market: https://www.wix.com/app-market
- Wix App Market billing: https://dev.wix.com/docs/build-apps/launch-your-app/pricing-and-billing/about-monetizing-your-app
- Wix Studio Partner Program: https://www.wix.com/studio/partner-program
- Neon: https://neon.tech
- Drizzle: https://orm.drizzle.team
- Turborepo: https://turbo.build/repo
- Cloudflare R2: https://developers.cloudflare.com/r2/

---

*Last updated: 2026-05-22. Maintainer: Prabhakar.*
