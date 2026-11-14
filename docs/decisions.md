# Decision log — wix-apps (Product Reviews)

**What this is:** every decision that shapes this repo, with the reason and who made it. **Why:** chats get summarised and agents change; this file does not. **What you get:** no one re-argues a settled choice, and no session quietly undoes one.

**Rules** (Bodham Labs module standard, notice 2026-10-15)
- Newest first. One row per decision: date · decision · why · by · status.
- **By:** Founder (only the founder makes or reverses it) or MD (delegated to Claude; reversible; the founder can overrule).
- **Status:** Active, Changed (points to the newer row), Revisit (with the trigger), Open.
- Company-wide decisions live in the Bodhamlabs claude.ai project, `claude/decisions.md` (HQ writes it). This file holds only this repo's decisions.
- History before October 2026 is in `docs/Wix_Apps_Portfolio.md` → "Cross-Cutting Decisions Log". Rows still in force are copied below; the old log is no longer appended to.

---

## Product and plans

| Date | Decision | Why | By | Status |
|---|---|---|---|---|
| 2026-11-15 | Email = **Zoho ZeptoMail** (Resend kept as fallback in code) | Company mail is already on Zoho; production Resend key was invalid; one provider for the bodhamlabs.com domain | Founder | Active — founder sets up ZeptoMail and the Vercel vars |
| 2026-10-14 | Free plan stays generous (spam check, owner digest, star filter, helpful votes, badge, import/export); paid plans get features that cost us per use or are clear growth tools | Free plan is the install engine on the App Market; Fera has no free plan | Founder | Active |
| 2026-10-14 | Plan ladder Free 50 / Starter $9 300 / Pro $29 1,500 / Growth $79 10,000 requests per month; feature gates in `lib/features.ts` | More requests per dollar than Fera at every tier | Founder | Active — Revisit after 50 paying stores |
| 2026-10-14 | Plan page shows "(coming soon)" next to anything not built; never sell a feature that does not exist | Honest-claims rule | Founder | Active |
| 2026-10-13 | No rating gating: same request to everyone, auto-publish applies to every rating, spam check reads content only | FTC, UK DMCC and Google rules; also our marketing | Founder | Active |
| 2026-10-13 | Incentives (thank-you coupon) are for any honest review and the review is labelled "Received an incentive" | Same rules | Founder | Active |
| 2026-10-13 | Product name in code is "Product Reviews" (`lib/product.ts`); public name not decided | Unboxly / Showfie suggested; ReelProof and Vouchly taken | Founder | Open |
| 2026-10-13 | Dashboard follows Wix's own look; storefront follows the merchant's store; Bodham Labs only as maker credit | Merchants trust native-looking apps; their shop stays theirs | Founder | Active |
| 2026-10-13 | Scope and requirements: `docs/01_reviews_app_prd_v2.md` (replaces `01_visual_ugc_reviews_mvp_spec.md`) | Rebuild under Bodham Labs after a code review | Founder | Active |
| 2026-05-21 | First app = Product Reviews (visual UGC reviews) | Uses Shopify experience; high retention | Founder | Active |

## Wix platform

| Date | Decision | Why | By | Status |
|---|---|---|---|---|
| 2026-10-14 | Use a **new app on the company Wix account** (prabhakar.chandra@bodhamlabs.com), App ID `3e8c1bc4-f9fc-4f01-a8db-9284759534f3`; the old NeoReviewKit app on another account is no longer used | Business assets belong to the business account | Founder | Active |
| 2026-10-14 | Auth = Wix OAuth **client credentials** (App ID + secret → token per site, cached encrypted, renewed 5 min early); installs arrive through the App Installed webhook; old install-redirect route removed | New Wix apps have no install redirect | MD | Active |
| 2026-10-14 | Storefront ships as **custom elements** (site plugins + site widgets) that load our `/widget*` pages; script `public/elements/reviews.js` built by `scripts/build-elements.mjs` | New Wix apps can't add iframe widgets | MD | Active |
| 2026-10-13 | Read products through `lib/wix/catalog.ts` only; support Catalog V1 and V3 | Stores are mid-migration to V3 | MD | Active |
| 2026-10-13 | Uninstall → Wix tokens deleted at once, store data deleted 29 days later | Privacy; lets a merchant reinstall within the month | MD | Active |

## Stack and architecture

| Date | Decision | Why | By | Status |
|---|---|---|---|---|
| 2026-10-14 | Deploy through **GitHub → Vercel Git integration**: Root Directory `apps/reviews`, Production Branch `master` | Vercel CLI not logged in on the PC; every deploy then matches a commit | Founder (on MD's recommendation) | Active — waiting for the founder to connect Git in Vercel |
| 2026-10-13 | Two daily Vercel crons: send requests (+ reminders, owner digest) 09:00 UTC; purge uninstalled 03:30 UTC | Vercel Hobby allows daily crons; no extra worker | MD | Active — Revisit if hourly sending is needed |
| 2026-05-22 | Email = **Resend** (was Postmark) | Postmark restricted our domain | Founder | Changed (see 2026-11-15 ZeptoMail) — sending domain moves from vibcoders.com to bodhamlabs.com before launch |
| 2026-05-22 | OAuth tokens encrypted with AES-256-GCM (`WIX_TOKENS_MASTER_KEY`); webhook work runs after the response with Next.js `after()` | Tokens safe at rest; Wix needs a reply in under 1 s | MD | Active |
| 2026-05-22 | `docs/GOTCHAS.md`: read before work, add an entry after any non-obvious fix | Stops agents re-learning the same traps | Founder | Active |
| 2026-05-21 | Monorepo: pnpm workspaces + Turborepo; `packages/` stays empty until app #2 needs the same code | Avoid premature abstraction | Founder | Active |
| 2026-05-21 | Neon Postgres, schema per app (`reviews`); Drizzle + drizzle-kit, never Prisma | Branching, cold-start speed, SQL fluency | Founder | Active |
| 2026-05-21 | Media on Cloudflare R2 via signed URLs | Zero egress fees | Founder | Active — R2 not switched on yet |
| 2026-05-21 | `AGENTS.md` at the root is the shared agent context; `CLAUDE.md` points to it | Any agent can pick up the work | Founder | Active |

## Repo, accounts and security

| Date | Decision | Why | By | Status |
|---|---|---|---|---|
| 2026-10-15 | Repo follows the Bodham Labs module kit: handoff doc `projects/wix-reviews-app-handoff.md` (claude.ai project), this log, `CHANGELOG.md`, root `AGENTS.md` | Company notice 2026-10-15 | Founder | Active |
| 2026-10-14 | Push to GitHub allowed; branch `feat/mvp-revamp` pushed. Replaces "no push until the MVP is finished" (13 Oct) | Needed for the Vercel Git deploy | Founder | Active |
| 2026-10-14 | Accounts are split: Wix app on the company email; Vercel and GitHub on the founder's personal Gmail. Check which account is signed in before any settings change | Avoid changing the wrong account | Founder | Active — Revisit before launch (move Vercel to a company team, repo to a Bodham Labs org) |
| 2026-10-13 | Repo **stays public** and is kept (not deleted); `scratch/` removed from the repo instead of making it private or rewriting history | Making it private erases stars and links; rewriting history is permanent deletion | Founder (keep), MD (method) | Active — conflicts with the module standard's "private repo"; founder to decide |
| 2026-10-13 | Production database migrations and publishing the test store need the founder's explicit yes | Irreversible or public | Founder | Active |
| standing | Never commit secrets; gitleaks scan before every push; never print `.env.local` values | Leaked keys in the past | Founder | Active |
