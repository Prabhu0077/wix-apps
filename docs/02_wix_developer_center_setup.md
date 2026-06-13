# Wix Developer Center — App #1 Registration Checklist

> Step-by-step setup for **Visual UGC & Video Reviews** in the [Wix Developer Center](https://dev.wix.com). Designed to be worked through in 1–2 hours by Prabhakar. After completing this, the app exists in the Wix system, can be installed on test sites, and is ready for the Week 2 build steps in `01_visual_ugc_reviews_mvp_spec.md`.

**Estimated time:** 60–90 minutes (excluding screenshots/listing copy, which can be polished closer to launch).

---

## 0. Prerequisites

- [ ] Wix account at `manage.wix.com` (use the same email as the App Market payouts account).
- [ ] A free Wix test site with **Wix Stores** installed — needed for end-to-end install testing.
- [ ] A public HTTPS URL pointing at your local dev server. Pick one and keep it consistent:
  ```bash
  # Option A: ngrok (requires free account)
  ngrok http 3000

  # Option B: Cloudflare Tunnel (no account, anonymous URLs)
  cloudflared tunnel --url http://localhost:3000
  ```
  Save the URL — you'll paste it in multiple places below. Call it `$TUNNEL_URL` here.
- [ ] Cloudflare R2 bucket created (name: `wix-reviews-media`) and an API token with read+write scope.
- [ ] Neon project created with a database for the Reviews app.
- [ ] Postmark account with a verified sending domain.

---

## 1. Create the App

- [ ] Go to <https://dev.wix.com/apps/my-apps> → **Create New App**.
- [ ] **App name:** `Visual UGC Reviews` (this is the internal name; the public listing name can differ).
- [ ] Save and open the new app's **Build Your App** dashboard.

You'll now see the navigation: **OAuth**, **Permissions**, **Components**, **Webhooks**, **App Market Listing**, etc.

---

## 2. OAuth Settings

Navigate to **OAuth**.

- [ ] **App ID** → copy to `WIX_APP_ID` in `apps/reviews/.env.local`.
- [ ] **App Secret Key** → copy to `WIX_APP_SECRET`.
- [ ] **Redirect URL:** `${TUNNEL_URL}/api/wix/install`
- [ ] **App URL (the dashboard URL inside Wix):** `${TUNNEL_URL}/`
- [ ] Save.

> Reminder: for production you'll swap `$TUNNEL_URL` for the Vercel deployment URL (e.g., `https://reviews.vercel.app`).

---

## 3. Permissions (OAuth Scopes)

Navigate to **Permissions** → **Request Permissions**. Add exactly the scopes below — *minimum needed for the MVP*. Wix reviewers reject apps that request more than they use.

| Permission | Scope ID | Why this app needs it |
|---|---|---|
| **Read Orders** | `SCOPE.DC-STORES.READ-ORDERS` | Listen for `Order Fulfilled` and `Payment Status Updated` to schedule review requests. |
| **Read Stores - Products** | `SCOPE.STORES.READ-PRODUCTS` | Fetch product names/images for review-request emails and PDP widget. |
| **Manage Contacts** | `SCOPE.CRM.CONTACTS-MANAGE` | Look up customer email and name from order's contact ID. |
| **Manage Inbox Messages** | `SCOPE.DC-INBOX.MANAGE-MSGS` | (Optional v2) Reply to customers via Wix Inbox after a review is posted. |
| **Read App Instance** | `SCOPE.APPS.READ-APP-INSTANCE` | Resolve `instanceId` ↔ siteId; check current plan tier. |

- [ ] Add the required four (top three + App Instance). Skip Inbox unless you're shipping the v2 reply feature.
- [ ] Save.

---

## 4. Webhooks

Navigate to **Webhooks**. For each event below, click **Add Webhook** and configure:

- **Callback URL:** `${TUNNEL_URL}/api/wix/webhook` (same URL for all events — fanout happens in code)
- **Event:** select from the dropdown

| # | Event | Slug we match in `webhook/route.ts` | Why |
|---|---|---|---|
| 1 | **Order Fulfilled** (`wix.ecom.v1.order`) | `wix.ecom.v1.order#fulfilled` | Primary trigger for "schedule review request". |
| 2 | **Order Payment Status Updated** (`wix.ecom.v1.order`) | `wix.ecom.v1.order#payment_status_updated` | Optional gate — skip review requests if payment failed. |
| 3 | **App Instance Installed** (`wix.app-market.v1.app-instance`) | `wix.app-market.v1.app-instance#installed` | Backup for the OAuth install flow in case the redirect fails. |
| 4 | **App Instance Removed** (`wix.app-market.v1.app-instance`) | `wix.app-market.v1.app-instance#removed` | Soft-delete the account / mark inactive when uninstalled. |

- [ ] Add all four.
- [ ] In the Webhooks page, find **Public Key** (the RSA public key used to sign webhook JWTs). Copy it to `WIX_WEBHOOK_PUBLIC_KEY` in `.env.local`. **Paste as a single line** with `\n` between header/body/footer, OR base64-encode it — whichever the JWT library expects.

---

## 5. Components

Navigate to **Components**. The Reviews app needs three:

### 5a. Dashboard Component (the merchant-facing settings UI inside Wix)
- [ ] **Add Component** → **Embedded Script** → use type **Dashboard**.
- [ ] **Component URL:** `${TUNNEL_URL}/` (Next.js renders the dashboard at the root).
- [ ] **Mobile compatible:** No (v1). Revisit when mobile dashboard demand shows up.

### 5b. Widget Component (the PDP review widget on the storefront)
- [ ] **Add Component** → **Widget**.
- [ ] **Widget name:** `Reviews Widget`.
- [ ] **Widget URL / script URL:** point to your bundled widget script. For v1 in dev, this can be `${TUNNEL_URL}/widget/reviews-widget.js` (the bundled output). Until the bundler is set up, leave as a placeholder and revisit during Week 5.
- [ ] **Inject into:** Product pages (will be configurable).

### 5c. (Optional v2) Embedded Script for storefront global injection
- [ ] Skip for v1. We use the Widget Component for PDPs only.

---

## 6. Billing & Pricing Plans

Navigate to **Pricing Plans** (or **Monetization** depending on Dev Center version).

- [ ] **Add Plan:** `Free` — $0/mo. Limits described in plan name only (no system enforcement; enforced in our code via the `plan` column on `accounts`).
- [ ] **Add Plan:** `Pro` — $29/mo. Description: *Unlimited review requests, video reviews, PDP carousel.*
- [ ] **Add Plan:** `Growth` — $79/mo. Description: *Everything in Pro + shoppable video wall, AI moderation, multi-language emails, importer from Loox/Yotpo/Judge.me.*
- [ ] **Annual variants:** Pro $290/yr, Growth $790/yr (≈ 2 months free).
- [ ] **Free trial:** Enable on Pro — 14 days.
- [ ] In **Webhooks**, ensure the following are subscribed (Wix may auto-add these with billing):
  - `wix.app-market.v1.app-instance#updated` — fires on plan upgrade/downgrade. Handle in `webhook/route.ts` to mirror the `plan` column on `accounts`.

---

## 7. App Market Listing (polish closer to launch — placeholder text OK now)

Navigate to **App Market Listing**.

- [ ] **Public name:** _(defer — see decisions log; placeholder `Visual UGC Reviews`)_
- [ ] **Tagline:** *Photo and video reviews that boost PDP conversion.*
- [ ] **Category:** Marketing → Reviews
- [ ] **Logo (square, 512×512 PNG):** placeholder for v1.
- [ ] **Cover image (1280×800):** placeholder for v1.
- [ ] **Screenshots (5–8, 1280×800):** at least one of the dashboard, one of the PDP widget, one of the moderation queue. Capture during Week 7.
- [ ] **Demo video (60–90s, YouTube/Vimeo):** record during Week 7.
- [ ] **Long description:** rewrite during Week 7 once the product voice is real.
- [ ] **Support email:** `support@<your-domain>` (defer with the domain).
- [ ] **Privacy Policy URL** and **Terms of Service URL**: required for submission. Stand up minimal versions at Week 7.

---

## 8. Test Site Install

- [ ] On your test site, navigate to the **Install URL** generated by the Dev Center (it looks like `https://www.wix.com/installer/install?appId=...&redirectUrl=...&token=...`).
- [ ] Approve the install. Wix should redirect to `${TUNNEL_URL}/api/wix/install?code=...&instanceId=...`.
- [ ] Verify in Neon Studio (`pnpm db:studio`) that a row was inserted into `accounts` for the new `wix_instance_id`.
- [ ] Trigger a test order on your test site, fulfill it. Verify the webhook hits `/api/wix/webhook` with `slug = "fulfilled"`. Currently the handler just logs — that's expected for the scaffold.

If install fails:
- Check the Dev Center → **OAuth** → redirect URL matches your tunnel exactly (https, no trailing slash).
- Check that `WIX_APP_ID` and `WIX_APP_SECRET` in `.env.local` match the Dev Center values.
- Tail `pnpm dev` console output for the `[install]` log line.

---

## 9. Wix Studio Partner Program (separate, do this once)

Not technically a Dev Center step, but it's the same week's paperwork and pays off across every app in the portfolio.

- [ ] Apply at <https://www.wix.com/studio/partner-program>.
- [ ] Approval takes 1–2 weeks; benefits include: direct PM contact, early Beta API access, App Market promotion slots.

---

## 10. Submission for App Market Review (closer to public launch)

You don't need to do this until Week 8. Listed here for reference.

- [ ] All listing fields filled (no placeholder text).
- [ ] Privacy policy + terms of service URLs live and accurate.
- [ ] Production environment (Vercel) deployed and the URLs in the Dev Center swapped from `$TUNNEL_URL` to the production domain.
- [ ] `WIX_WEBHOOK_PUBLIC_KEY` verified by a real signed request — **dev bypass in `lib/wix/webhooks.ts` must be replaced with real JWT verification before production**.
- [ ] Submit via Dev Center → **Submit for Review**. Typical review cycle: 3–5 business days. Address feedback and resubmit.

---

## Quick Reference — Env Var Source-of-Truth

| Env var | Where in Dev Center |
|---|---|
| `WIX_APP_ID` | OAuth → App ID |
| `WIX_APP_SECRET` | OAuth → App Secret Key |
| `WIX_WEBHOOK_PUBLIC_KEY` | Webhooks → Public Key |

---

## When this checklist is done

- App row in `accounts` table populated by a real install.
- Webhook log lines show `Order Fulfilled` events arriving from the test site.
- Dev Center reports the app as **active** with a test install.

Then return to `01_visual_ugc_reviews_mvp_spec.md` §7 — Week 2 begins: implement real Wix client calls, wire ReviewRequest scheduling, and replace the dev signature-verification bypass.
