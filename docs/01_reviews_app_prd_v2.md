# Product Reviews App — PRD v2 (Bodham Labs)

> Supersedes the scope and pricing in `01_visual_ugc_reviews_mvp_spec.md` (May 2026). That file stays as history; the data model and architecture in it still apply unless this document says otherwise.
>
> Written 2026-10-13 from three research passes done that day (competitor strategy, low-maintenance roadmap, claims verification). Evidence labels: **Confirmed** (Wix/Google primary page or live observation), **Estimate**, **Untested**.
>
> Working name: "Product Reviews by Bodham" (final public name is open question Q1).

---

## 1. Problem statement

Wix Stores merchants who want trustworthy product reviews have three poor choices. Native **Wix Reviews** is free but rated 3.5 (65 reviews), cannot export reviews, cannot restrict reviews to verified buyers, caps imports at 500, and does not send reviews to Google Merchant Center (all from Wix's own feature-request pages — Confirmed). **Fera** is good (4.8, 4,053 reviews) but has no free plan and meters on orders, requests, seats and storage. **Kudobuzz** removed its free plan on 31 Aug 2026 and now sits at 3.6 with 193 one-star ratings (Confirmed), leaving a pool of displaced merchants.

The cost of not solving it: merchants either pay for complexity they do not need or run reviews they cannot trust, move or show in Google. For Bodham Labs, this app is the first product on Wix — it earns the Verified badge, the merchant list and the developer rating that every later app depends on.

## 2. Goals

| # | Goal | Type | Measure |
|---|---|---|---|
| G1 | Merchants collect their first verified review fast | User | Median time from install to first published review < 21 days (14-day request delay + 7) |
| G2 | Merchants trust the app with their data | User | 100% of installs can export all reviews on every plan; zero "reviews held hostage" complaints |
| G3 | Earn the Wix Verified badge | Business | 40 live installs on Premium Wix sites at day 60 after launch (Wix's threshold — Confirmed) |
| G4 | Reach first recurring revenue | Business | 10 paying merchants within 90 days of launch (target, not benchmark-based) |
| G5 | Keep the developer rating high | Business | App rating ≥ 4.5 with ≥ 10 reviews by day 90 (developer page shows one average across all our apps — Confirmed) |

## 3. Non-goals (v1)

| Non-goal | Why |
|---|---|
| AliExpress / Amazon / Temu review import | Highest fake-review risk under FTC rule, UK DMCC Act and Google's 24 Jul 2026 review-snippet guideline |
| Reviews for Wix Bookings / services | Different buyer; Wix's open "Reputation management (Bookings)" request is about Google/Yelp prompts. Decide after Verified |
| SMS / WhatsApp review requests | No demand evidence on Wix; adds cost and deliverability support |
| Video transcoding pipeline (FFmpeg worker) | Accept short native-format clips stored in R2; transcoding is a later cost |
| Shoppable UGC gallery, Q&A, AI summaries | Supply gaps confirmed but demand unproven; P2 |
| Usage-based overage billing | Requires Wix approval, cannot combine with recurring plans, and is the top cause of 1-star reviews at Loox |

## 4. Users

- **Store owner (primary):** small Wix Stores merchant, English-first, mostly US/UK (Wix stores: 44% US, 10% UK — Store Leads, third-party). Wants more sales from social proof without effort or surprise bills.
- **Shopper (secondary):** buyer who receives the request email and leaves a review with no login.
- **Store visitor:** reads reviews and stars on product pages.

## 5. User stories (priority order)

**Store owner**
1. As a store owner, I want review requests sent automatically after an order is fulfilled so that I collect reviews without manual work.
2. As a store owner, I want every review marked "Verified buyer" when it comes from a real order so that visitors and Google trust it.
3. As a store owner, I want to approve, hide or reply to reviews before they go live so that I control what shows on my store.
4. As a store owner, I want to import my reviews from Wix Reviews, Kudobuzz or a CSV so that I do not start from zero.
5. As a store owner, I want to export all my reviews at any time on any plan so that I am never locked in.
6. As a store owner, I want a health check that tells me if the widget, product matching or emails are broken so that I do not lose reviews silently.
7. As a store owner, I want a warning before I hit my plan limit, and my existing reviews to stay visible after it, so that I am never surprised.
8. As a store owner, I want star ratings on product pages and in Google results so that I win more clicks.
9. As a store owner on a free Wix site, I want the core app to work without paying so that I can try it properly.

**Shopper**
10. As a shopper, I want to leave a rating, text and photos from a link in my email without creating an account so that it takes under a minute.
11. As a shopper who got a coupon for reviewing, I want it to arrive whatever rating I give so that I can be honest.

**Edge cases**
12. As a store owner whose product was deleted, I want its reviews kept and exportable so that nothing is lost.
13. As a store owner who uninstalls, I want my data deleted within 30 days unless I export first (Wix GDPR rule — Confirmed).

## 6. Requirements

### P0 — must ship

| ID | Requirement | Acceptance criteria |
|---|---|---|
| R1 | Post-fulfilment request email | Given an order fulfilled webhook, when the delay (7/14/21 days, default 14) passes, then one email per order is sent via Resend; duplicate webhooks do not create duplicate requests; free plan stops at 50 requests/month with a dashboard warning at 80% |
| R2 | No-login review form | Rating (1–5), text, up to 5 photos to R2 via signed URL; works on mobile; token expires after 60 days; one submission per product per order |
| R3 | Verified-buyer badge | Reviews from a request token carry `verified=true` from the Wix order; imported or manual reviews are labelled "Imported" / "Unverified"; label shows in widget |
| R4 | Moderation dashboard | List, filter by status/rating, approve, hide, reply; **no rating-based auto-gating by default** (auto-publish rule applies equally to all ratings) |
| R5 | Product-page widget | Star summary + review list with photos; Wix site plugin slot on both old and new product pages (Confirmed requirement); < 30 KB initial JS; no `<h1>`; no "powered by" text |
| R6 | Catalog V1 + V3 support | App passes on a V1 store and a V3 store; V3 compatibility confirmed in the app dashboard (Wix will not list the app otherwise — Confirmed) |
| R7 | Signed instance auth | Every dashboard API derives `instanceId` from the HMAC-verified Wix instance (done in commit `aa15e2b`); webhook JWT verification replaces the dev bypass before submission |
| R8 | Import | CSV (any source) plus one-click from Wix Reviews; product matching by SKU, then slug, then name; an import report lists unmatched rows; no 500-row cap |
| R9 | Export | CSV of all reviews and media URLs, every plan including Free |
| R10 | Install health check | Dashboard card: widget placed? products matched? last email sent? last webhook received? Each with a fix link |
| R11 | Plan gating and billing | Wix Billing only; plans Free / Starter $9 / Pro $29 / Growth $79 (monthly; yearly discount); one meter: review requests per month; reviews never hidden when a limit is reached |
| R12 | Compliance defaults | Incentive flag auto-applied when a coupon is attached and shown on the review; reward given for any rating; default email copy contains no sentiment-leading wording; review policy page template |

### P1 — fast follow (after Verified)

| ID | Requirement | Note |
|---|---|---|
| R13 | AggregateRating / Review JSON-LD | **Blocked on test T2–T4** (does Wix add ratings itself; are API-written tags server-rendered; replace or duplicate) |
| R14 | Google Shopping product-review feed (Pro) | Merchants can self-submit in Merchant Center (Confirmed); UI must state the 50-review minimum |
| R15 | Reminder email (one, 7 days after the first) | Starter+ |
| R16 | Carousel + all-reviews page widgets | Starter+ |
| R17 | Coupon reward for reviews | Starter+; depends on R12 |
| R18 | Import from Kudobuzz export | Migration offer for displaced Kudobuzz merchants |
| R19 | Photo + short video upload enabled | Turn on R2 route (exists, returns 503 today) |

### P2 — design for, do not build

AI review summary and reply drafts (own LLM key, per-install budget, approval-first; tools exposed to Wix's Aria assistant via App Tools); product Q&A; review-media gallery with click-through to product; multilingual request emails; Bookings reviews.

## 7. Plans

| Plan | Price (USD/mo) | Requests/mo | Adds |
|---|---|---|---|
| Free | 0 | 50 | Photos, widget, moderation, verified badge, import, export, health check |
| Starter | 9 | 300 | Reminder, carousel + all-reviews page, coupon rewards |
| Pro | 29 | 1,500 | Google Shopping review feed, video, (P2: AI summary/replies, Q&A) |
| Growth | 79 | 10,000 | Priority support, multi-language emails |

Rules: the Free plan is permanent once launched; price rises apply to new users only (Wix rule — Confirmed); 14-day Wix-managed trial of Pro. Prices are a proposal, not tested against Wix conversion data (none is public).

Net revenue (Estimate): Wix keeps 0% for 12 months then 20%, after a 2.5% fee. Whether the 12-month window is per app or per account is **not confirmed**; plan on one window starting at this app's launch.

## 8. Success metrics

| Metric | Leading / lagging | Target | Source |
|---|---|---|---|
| Install → request email sent within 30 days | Leading | ≥ 60% | App DB |
| Request → review submitted | Leading | ≥ 5% | App DB |
| Health-check issues unresolved after 7 days | Leading | ≤ 10% of installs | App DB |
| Live Premium-site installs | Lagging | 40 at day 60 | Wix app dashboard |
| Paying merchants | Lagging | 10 at day 90 | Wix payouts |
| App rating | Lagging | ≥ 4.5 | App Market listing |
| Support time | Lagging | < 5 h/week | Support log |

Targets are Bodham's own choices; no Wix benchmark exists to anchor them. Review at 30, 60 and 90 days.

## 9. Open questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| Q1 | Public app name (shortlist: Unboxly, Showfie; must contain "Reviews" in listing name) | Founder | Before listing |
| Q2 | Is the 12-month 0% revenue window per app or per account? | Wix support | No |
| Q3 | Does Wix add `aggregateRating` to product JSON-LD when Wix Reviews has published reviews? | Claude (test T2) | Blocks R13 |
| Q4 | Are JSON-LD tags written via Item SEO Tags API server-rendered, and do they replace or duplicate the preset? | Claude (test T4) | Blocks R13 |
| Q5 | Does "site SEO must be free" cover paid schema features? | Wix support | Blocks R13 pricing |
| Q6 | GST and withholding on USD payouts | CA | Before first payout |
| Q7 | Partner Program + Tipalti set up on the company Wix account | Founder | Blocks paid publish |

## 10. Timeline

| Step | When | Gate |
|---|---|---|
| Test store tests T1–T5 (store `Bodham Test Store`, Wix account prabhakar.chandra@bodhamlabs.com) | This week | Q3, Q4 answered |
| P0 build-out on existing code, QA on V1 + V3 stores | Q4 2026, 4–6 weeks (Estimate) | All P0 acceptance criteria pass |
| Partner Program + Tipalti, listing assets, submit | End Q4 2026 | Wix review passed |
| P1 items | After launch, as Verified approaches | 40 Premium installs |

Dependencies: Vercel deploy and Wix app registration on the company account (the old app, if any, lived on another account); Resend sending domain moved to a Bodham Labs subdomain.

---

*Research behind this document: reports "Wix reviews app competitor strategy", "Wix low maintenance app roadmap" and "Wix roadmap claims verification" (13 Oct 2026).*
