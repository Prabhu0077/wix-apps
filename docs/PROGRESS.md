> **History (June 2026), not current.** Current progress: `CHANGELOG.md` (root) and the Progress section of `docs/02_reviews_mvp_tasks.md`. Some steps below (OAuth install route, Postmark, 5-minute cron) no longer apply.

# Progress & Action Plan — Wix Reviews App

_Last updated: 2026-06-13_

---

## ✅ Done

| Area | Detail |
|------|--------|
| Git | `git init` + initial commit. Repo at `D:\wix`. |
| Database | Neon Postgres live. Schema migrated (accounts, review_requests, reviews, review_media). AES-256-GCM token encryption. |
| Wix OAuth | Install route (`/api/wix/install`) exchanges code, encrypts + stores tokens, upserts account row. |
| Webhook pipeline | `/api/wix/webhook` verifies signature (dev-bypass for now), fans out events. `order#fulfilled` → schedules ReviewRequest in DB (14-day delay). Idempotent. |
| Email | Switched from Postmark → Resend. `RESEND_API_KEY` live. Domain `vibcoders.com` registered on Resend. DNS records extracted to `scratch/dns_records_full.json`. |
| Email cron | `/api/cron/send-requests` — picks SCHEDULED requests due now, sends via Resend, marks SENT. Runs every 5 min via `vercel.json`. |
| Review submission | `GET /api/public/review/[token]` — resolves product names from Wix API. `POST` — inserts Review + optional media rows, marks request COMPLETED. |
| Review page | `/review/[token]` — clean customer-facing form (stars, name, text). Media upload disabled for v1. |
| R2 upload stub | `/api/public/review/upload-signature` built and tested — returns 503 until R2 is activated. Re-enable when ready. |
| Credentials backup | `C:\Users\prabh\.wix-creds\wix_reviews_credentials.json` — all keys in one place, outside repo. |

---

## 🔴 Blockers (ordered by what unblocks the next thing)

### 1. Deploy to Vercel — YOU, ~20 min

The app needs a live URL before Wix Dev Center will accept it.

```powershell
# In D:\wix\apps\reviews
npm i -g vercel   # if not already installed
vercel            # follow prompts; link to your Vercel account
```

After deploy, copy the production URL (e.g. `https://reviews-xyz.vercel.app`).

Then add all env vars from `.env.local` to Vercel:
- Go to Vercel dashboard → Project → Settings → Environment Variables
- Add every key from `.env.local` (except the mock ones)
- Set `NEXT_PUBLIC_APP_BASE_URL` to the production URL

### 2. Wix Dev Center — YOU, ~60–90 min

Needs the live Vercel URL from step 1.

Follow `docs/02_wix_developer_center_setup.md`. Key things to collect and paste into `.env.local` + `C:\Users\prabh\.wix-creds\wix_reviews_credentials.json`:

- `WIX_APP_SECRET` — from Dev Center app settings
- `WIX_WEBHOOK_PUBLIC_KEY` — from the webhook config page

Set these URLs in Dev Center:
- **OAuth redirect URL**: `https://<your-vercel-url>/api/wix/install`
- **Webhook endpoint**: `https://<your-vercel-url>/api/wix/webhook`
- **Subscribe to events**: `wix.ecom.v1.order#fulfilled`, `wix.app-market.v1.app-instance#installed`

### 3. Real JWT webhook verification — ME, ~15 min after you have the key

Once `WIX_WEBHOOK_PUBLIC_KEY` is a real value (not the mock), I swap the dev-bypass in `lib/wix/webhooks.ts` for real `jose` signature verification. This is the security gate before launch.

### 4. Resend DNS verification — YOU + ME, ~30 min

DNS records for `vibcoders.com` need to be added to Vercel DNS so Resend can verify the domain. Records are in `scratch/dns_records_full.json`. Once the domain is live on Vercel, I can use the Vercel CLI to add them automatically.

---

## 💡 After the above — Week 4+ work

| Feature | Why |
|---------|-----|
| Merchant dashboard (reviews list + approve/reject) | Merchants need to see and moderate reviews |
| PDP widget (`widget/reviews-widget.js`) | Customers see reviews on product pages — the whole point |
| Billing webhook handler | Without it, plan upgrades don't register |
| End-to-end test install on a real Wix test site | Before App Market submission |
| App Market listing assets (logo, screenshots, video) | Required for submission |

---

## 🗝️ Key credentials location

`C:\Users\prabh\.wix-creds\wix_reviews_credentials.json` — master key file, gitignored, outside repo.
- 2026-11-14 · Vercel project `reviews` connected to GitHub `Prabhu0077/wix-apps` (Root Directory `apps/reviews`, production branch `master`); local `master` fast-forwarded to `feat/mvp-revamp` (5f19b9b); push did not go out: GitHub asked this PC to sign in again · Next: founder signs in to GitHub once on the PC, then push `feat/mvp-revamp` and `master` (deploys production), register extensions, live test · Blocked: founder's GitHub sign-in
- 2026-11-15 · Build fix (env and db lazy, `RESEND_*` optional, `vercel.json` build command) b8feb2f, be3e39e; Vercel preview green; PR #1 merged (1a4e275); production Ready on the new code; public endpoints smoke-tested (pages 200, widget 200, webhook rejects unsigned 401, cron 401 without secret, review API 404 for a bad token = database reachable) · Next: register extensions in the Wix app dashboard, live test on the test store · Blocked: no browser on the PC is signed in to Wix with the company account (founder signs in)
- 2026-11-15 (later) · Wix: 4 extensions registered (2 site plugins, 2 custom-element widgets, script on production), webhooks and dashboard URL checked; app installed on Bodham Test Store; manual order #10001 fulfilled → review request scheduled; review submitted via its link, published and replied in the dashboard; widget and badge pages show it; `/panel` page added (985d6db) · Next: see the reviews section on the product page in Editor preview, then publish the store; founder fixes email · Blocked: Resend API key in Vercel is invalid (email cannot send)
- 2026-11-15 (night) · Test store published; live product page showed nothing until the CORS fix for /api/widget/instance (f5fb8d3); now badge "4.0 (1 review)" and the reviews section with reply show on the live site · Next: founder fixes Resend, then a real email send test; remove Wix Reviews from the test store (two review sections) · Blocked: RESEND_API_KEY invalid
- 2026-11-15 (night) · Founder chose Zoho ZeptoMail for email; transport added with Resend fallback (933482d), test for the request shape · Next: founder sets up ZeptoMail (domain + token) and Vercel vars, then a real send test · Blocked: ZeptoMail account and token (founder)
