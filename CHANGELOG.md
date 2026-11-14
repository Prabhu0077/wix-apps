# Changelog — wix-apps

**What this is:** what changed in the repo, per version, newest first. **Why:** the Bodham Labs module standard asks every project for one progress file. **What you get:** the state of the app at a glance; task-level detail is in `docs/02_reviews_mvp_tasks.md` (Progress section), decisions in `docs/decisions.md`.

Status words: **Built** = in code and tested with mocked APIs; **Live** = running for real stores. Nothing is Live yet.
Versions: the app is `@wix-apps/reviews` 0.0.1 in `package.json`; the version names below group the work until the first release is tagged.

---

## 15 Nov 2026 — deployed to production (Vercel, from `master`)

- Live test on the test store: extensions registered (plugins Product Reviews + Rating Badge on the product page, widgets Reviews Carousel + All Reviews); install webhook created the account; a fulfilled manual order scheduled a review request (signed webhook accepted); review form saved a review; dashboard publish and reply work; `/widget` and `/widget/badge` show it. Email failed: Resend says the production API key is invalid. Added `/panel` (Editor settings panel Wix requires for plugins).
- PR #1 merged into `master` (merge commit `1a4e275`); production `reviews-ten-liard.vercel.app` serves this code (Vercel Git deploy). Public endpoints smoke-tested; not yet run on a live Wix store.
- Fix: `next build` no longer needs runtime secrets (env checked on first use, database client created on first use); `RESEND_*` optional, sending fails with a clear "Email is not configured" error. `vercel.json` pins the build command to `pnpm build` (Vercel's auto-detected `turbo run build` failed).

## Unreleased — 0.1.0 "Product Reviews MVP" (branch `feat/mvp-revamp`, 13–15 Oct 2026)

Pre-launch. Not deployed from this branch yet; not run on a live Wix store.

### 2026-10-15
- Bodham Labs module kit: `docs/decisions.md`, this changelog, root `AGENTS.md` rewritten for the current app; `docs/PROGRESS.md` marked as history.

### 2026-10-14
- New Wix app auth (client credentials), install via App Installed webhook, storefront as custom elements (`0236a63`); app registered on the company Wix account (`e5efdab`).
- Free and Starter extras to compete with Fera: spam check, owner digest, star filter, helpful votes, rating badge, reminder, thank-you coupon, carousel, all-reviews page, ask recent customers; roadmap `docs/03_reviews_roadmap.md` (`25de20b`). Migration 0007 applied (`b895854`).
- MVP finished in code: Wix Reviews / CSV import, setup check, light widget, photos (off until R2), compliance pages (`66e9421`). Migration 0006 applied.
- Branch pushed to GitHub (founder yes).

### 2026-10-13
- Rebuild under Bodham Labs from PRD v2 (`5ea16a6`, `625cdf3`): Wix-native dashboard, monthly plan limits, Catalog V1 + V3, one review per product, unsubscribe and suppression list, store name and postal address, uninstall clean-up, CSV export (`dbd5644` … `e26b406`). Migrations 0002–0005 applied.
- Security: dashboard APIs verify the signed Wix instance (`aa15e2b`); `scratch/` removed from the repo (`43f66d8`).

## 0.0.1 — "NeoReviewKit v1" (13–14 Jun 2026, branch `master`)

- Scaffold, Neon schema, Resend email, webhook pipeline, review form, email cron, moderation, billing, settings, widget, privacy and support pages (`a764218` … `882dfef`). Superseded by the October rebuild; history in `docs/PROGRESS.md`.
