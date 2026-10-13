# Product Reviews MVP — task breakdown

> Breaks the P0 requirements (R1–R12) in `01_reviews_app_prd_v2.md` into tasks. Written 2026-10-13 after reading the current code in `apps/reviews`.
>
> **Owner key:** **F** = founder / senior dev (security, billing, Wix APIs, data model). **I** = BCA intern (bounded, testable, no secrets or production data). **C** = Claude can draft the code for review.
>
> **Size:** S ≈ half a day, M ≈ 1–2 days, L ≈ 3–5 days (estimates).
>
> **Rule for everyone:** no push to GitHub until the MVP is finished (founder rule, 13 Oct). Work on local branches; commit often.

---

## Progress

- 2026-10-13, commit `dbd5644` on branch `feat/mvp-revamp`: done T1.2, T1.5, T2.1, T3.1, T3.2, T4.1, T4.2, T7.1 and bugs B1, B5, B6, B8, B10, B11. Also: Wix-native redesign, rating-gate setting removed, plan page on PRD ladder. Not yet run against a database or Wix.
- 2026-10-13, commit `11c192a`: review dates show when the review was written (`createdAt`), with relative labels; was showing publish date.
- 2026-10-13, T1.3 done (+ T9.1, B2, B9): monthly request limit per plan enforced in the webhook; over-limit orders stored as `SKIPPED`; usage card with 80% warning and "limit reached" state on Overview and Plan; STARTER added to the plan enum; `resolvePlan` maps all four plans; unique index stops duplicate requests per order. Migration `0003_plan_limits` generated, not run.
- 2026-10-13, T6.1 done in code (B3): `lib/wix/catalog.ts` reads product name and image on Catalog V1 or V3 (version check, fallback V3 then V1); cron email and review form use it. Review links for SKIPPED/FAILED requests return not found. Still needed: add the three catalog permissions and tick V3 compatibility in the Wix app dashboard (T6.2), then test on the V3 test store.
- 2026-10-13, T2.2 done in code (B4): review form shows one block per product; shopper rates any and skips the rest; API saves one review per rated product. The request is claimed (status COMPLETED) before saving, so a double tap can't save twice; on a save error the claim and any saved rows are undone. Product IDs must belong to the order; media keys must start with `reviews/<token>/`. 360 px layout checked on a static preview (no horizontal scroll, 44 px star targets) — T2.3 still needs a check on the real page.
- 2026-10-13, T1.6 done in code (B7): unsubscribe footer link and `/unsubscribe/[token]` page with a confirm button; one-click `List-Unsubscribe` headers; per-store suppression list (`email_suppressions`, email stored as a hash); webhook and cron both honour it. Migration `0004_email_suppressions` generated, not run. Open: CAN-SPAM also wants the sender's postal address in commercial email — the merchant is the sender, so read the business address from Wix site properties along with the store name (extend T1.4); no re-subscribe flow (shopper asks the store).

## 0. Bugs and gaps found in the current code

Read on 13 Oct 2026. These come before new features because several of them break PRD acceptance criteria.

| # | Finding | File | Why it matters | Fix task |
|---|---|---|---|---|
| B1 | Webhook handles `wix.ecom.v1.order#approved` but the handler and spec say "fulfilled" | `app/api/wix/webhook/route.ts` | Requests may go out before the order ships | T1.2 |
| B2 | **Free-plan cap of 50 requests/month is not enforced anywhere.** `docs/GOTCHAS.md` says it is | webhook route | Free merchants are uncapped; billing has no trigger | T1.3 |
| B3 | Product lookups use Catalog **V1** only (`stores/v1/products`) | cron route, public review route | Wix will not list apps without V3 support; new stores are V3 | T6.1 |
| B4 | Review form saves a review only for the **first** product of a multi-item order | `app/api/public/review/[token]/route.ts` | Other products never get reviews | T2.2 |
| B5 | Email "store name" is taken from the owner's email domain | cron route | Emails show e.g. "gmail.com" as the store | T1.4 |
| B6 | Failed sends retry forever every 5 minutes; no attempt counter | cron route | A bad address loops; Resend quota burns | T1.5 |
| B7 | No unsubscribe line or link in the request email | cron route | Email compliance (CAN-SPAM / UK PECR) | T1.6 |
| B8 | No `verified` / `source` fields on reviews | `drizzle/schema.ts` | R3 cannot be built | T3.1 |
| B9 | Plan enum has FREE / PRO / GROWTH, no STARTER | `drizzle/schema.ts` | PRD plan ladder needs four plans | T9.1 |
| B10 | Approving again resets `publishedAt` | `app/api/reviews/[id]/route.ts` | Review order on the widget jumps | T4.2 |
| B11 | Webhook signature check is real (`jose`) but bypasses on failure when `NODE_ENV` ≠ production | `lib/wix/webhooks.ts` | Any preview deploy with a wrong env accepts fake webhooks | T7.1 |
| B12 | Install route is a stub; no uninstall handling or data deletion | `app/api/wix/install`, webhook `#removed` | GDPR 30-day deletion rule; app review | T7.3 |
| B13 | `NODE_ENV=production` is set system-wide on the founder's PC, so `pnpm install` skips devDependencies | PC environment | `tsc`, `drizzle-kit`, `eslint` missing locally | Note in GOTCHAS |
| B14 | `pnpm-lock.yaml` was out of date with `package.json` (tailwind entries) | repo root | Clean installs fail with `--frozen-lockfile` | Commit the refreshed lockfile |
| B15 | Upload-signature route signs R2 uploads for **any** token string (never checks the review request exists or is open); 100 MB limit | `app/api/public/review/upload-signature/route.ts` | Anyone could fill our bucket once R2 is on | T2.4 (must fix before R2 activation) |

---

## 1. Review requests (R1)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T1.1 | Write a fixture webhook payload for order events and a local script that posts it to `/api/wix/webhook` | I | S | Script schedules one request in a dev DB |
| T1.2 | Confirm the correct Wix event for "order fulfilled" in Wix docs; switch the handler; keep the dedupe check | F | S | Test payload of the right event schedules a request; `approved` does not |
| T1.3 | Enforce the monthly request cap per plan at scheduling time; store a `skipped_quota` count; dashboard warning at 80% | F | M | 51st request on Free is not scheduled; counter visible |
| T1.4 | Read the real store name from Wix site properties at install; store in `accounts.settings` | C → F | S | Email header shows the site name |
| T1.5 | Add `attempts` and `last_error` to `review_requests`; give up after 5 attempts with status `FAILED` | C → F | S | A bad address stops after 5 tries |
| T1.6 | Add unsubscribe footer and a `/unsubscribe/[token]` page; suppress future requests for that email per store | I | M | Clicking the link blocks the next request for that store |
| T1.7 | Default email copy review: neutral wording, no "tell us how much you loved it" | I | S | Copy checked against PRD R12 |

## 2. Review form (R2)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T2.1 | Extend token expiry from 30 to 60 days (form, API and email text) | I | S | All three say 60 |
| T2.2 | Form shows one rating block per product in the order; API inserts one review per product | F | M | 2-item order produces 2 reviews |
| T2.3 | Mobile layout check of `/review/[token]` at 360 px | I | S | No horizontal scroll; tap targets ≥ 44 px |
| T2.4 | Photo upload (up to 5) once R2 is active; size and type checks client and server side | F | M | Photo appears in moderation and widget |

## 3. Verified buyer (R3)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T3.1 | Migration: add `verified boolean`, `source enum(REQUEST, IMPORT, MANUAL)`, `source_ref`, `original_date` to `reviews` | F | S | Drizzle migration generated and applied to dev branch |
| T3.2 | Set `verified=true, source=REQUEST` on token submissions | F | S | New reviews carry the flag |
| T3.3 | Widget and dashboard show "Verified buyer" / "Imported" labels | I | S | Labels visible on both |

## 4. Moderation (R4)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T4.1 | Optional auto-publish setting that applies to **all** ratings equally (no rating gate) | F | S | Setting on: 1-star and 5-star both publish |
| T4.2 | Keep the first `publishedAt` on re-approve | I | S | Re-approve does not change the date |
| T4.3 | Filters by rating and status; empty states | I | M | All filters work on 100 seeded reviews |

## 5. Widget (R5)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T5.1 | Register site plugin for **both** old and new product pages in the app dashboard | F | M | Widget appears on both page types on the test store |
| T5.2 | Bundle size check (< 30 KB initial JS), no `<h1>`, no "powered by" | I | S | Lighthouse and source check recorded |
| T5.3 | Empty state when a product has no reviews | I | S | No broken box on products without reviews |

## 6. Catalog V1 + V3 (R6)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T6.1 | Small `lib/wix/catalog.ts`: detect catalog version, fetch product name/image via V1 or V3; replace direct calls in cron and review routes | F | M | Works on a V1 store and the V3 test store |
| T6.2 | Confirm V3 compatibility in the app dashboard | F | S | Checkbox done |

## 7. Security and Wix lifecycle (R7)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T7.1 | Webhook verify: never bypass unless an explicit `WIX_WEBHOOK_DEV_BYPASS=1` is set | C → F | S | Wrong signature returns 401 in every env without the flag |
| T7.2 | Real OAuth install flow on the company Wix account's app; store encrypted tokens | F | M | Fresh install on test store creates an account row |
| T7.3 | `app-instance#removed`: mark account, delete data after 30 days (scheduled job) | F | M | Uninstall then job removes rows |
| T7.4 | Run `gitleaks` before every commit batch (cloud copy if not installed locally) | I | S | Scan log saved with each batch |

## 8. Import, export, health check (R8–R10)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T8.1 | CSV importer: column mapping, product match by SKU → slug → name, import report of unmatched rows, `source=IMPORT` | F | L | 1,000-row test file imports; report lists misses |
| T8.2 | Wix Reviews one-click import (via Wix Reviews API if available, else its CSV export) | F | M | Test store's reviews copied |
| T8.3 | CSV export of all reviews + media URLs, every plan | I | S | Export opens in Excel with correct columns |
| T8.4 | Health-check card: widget placed, products matched, last email sent, last webhook received | I | M | Each item shows green/red with a fix link |

## 9. Plans and billing (R11)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T9.1 | Add STARTER to plan enum; map Wix plan names → enum in `resolvePlan` | F | S | Plan shown correctly for each test plan |
| T9.2 | Create the four plans in the Wix app dashboard (names ≤ 23 chars, 4 benefits each, yearly discount, 14-day trial) | F | S | Pricing page shows four plans |
| T9.3 | Gate Starter/Pro features in code; reviews never hidden on downgrade | F | M | Downgrade test keeps all reviews visible |

## 10. Compliance (R12)

| ID | Task | Owner | Size | Done when |
|---|---|---|---|---|
| T10.1 | Review policy page template (merchant copies to their site) | I | S | Template in dashboard |
| T10.2 | Incentive flag field and label (used later by coupons) | F | S | Flag stored and shown |
| T10.3 | Privacy policy and terms pages updated for Bodham Labs (company, support@ address, sub-processors: Neon, Resend, Cloudflare, Vercel) | I → F | S | Pages live in app |

---

## Suggested order (first two weeks)

1. **Day 1:** commit refreshed lockfile; add B13 to GOTCHAS; type-check passes. T7.1, T1.2, T1.5.
2. **Week 1:** T3.1–T3.2, T1.3, T6.1, T2.2, T7.2 (needs app registered on the company Wix account).
3. **Week 2:** T5.1, T8.1, T8.3, T8.4, T9.1–T9.3.
4. **Interns in parallel:** T1.1, T1.6, T1.7, T2.1, T2.3, T3.3, T4.2, T4.3, T5.2, T5.3, T10.1.

Blocked items: T2.4 (R2 activation), T5.1 / T7.2 / T9.2 (app registered on company account), PRD R13 JSON-LD (test store published — founder yes pending).
