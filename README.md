# Wix Apps Portfolio

A portfolio of apps for the [Wix App Market](https://www.wix.com/app-market), built and maintained by Prabhakar.

**Goal:** Build a portfolio of apps that earn recurring revenue. Freemium → paid upgrade model. Solo / small dev team. Each app is modular and shares core infrastructure (extracted on demand, not preemptively).

## Apps

| # | App | Status | Path |
|---|---|---|---|
| 1 | Visual UGC & Video Reviews | spec | `apps/reviews/` |
| 2 | Loyalty 2.0 | idea | _TBD_ |
| 3 | Subscription Power-Up Suite | idea | _TBD_ |
| 4 | AI Search & Schema Optimizer (AEO/GEO) | idea | _TBD_ |
| 5 | Smart Waitlist for Wix Bookings | idea | _TBD_ |

See `docs/Wix_Apps_Portfolio.md` for the living tracker and `docs/Wix_App_Opportunities_2026.docx` for the deep research report behind these choices.

## Repo Structure

```
apps/         # Each Wix app (Next.js 15)
packages/     # Shared code — empty until app #2 forces extraction
docs/         # Strategy, research, per-app specs
scripts/      # Operational helpers (e.g., docs mirror)
```

## Stack

Next.js 15 (App Router) · TypeScript · pnpm · Turborepo · Neon Postgres · Drizzle ORM · Cloudflare R2 · Postmark · Twilio · Vercel · Railway.

## For Agents

If you're a coding agent (Claude Code, Codex, Antigravity, etc.), read [`AGENTS.md`](./AGENTS.md) first.

## License

Proprietary. All rights reserved.
