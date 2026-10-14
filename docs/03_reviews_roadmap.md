# Product Reviews — roadmap and competitive plan

> Written 14 Oct 2026. Companion to `01_reviews_app_prd_v2.md` (scope) and `02_reviews_mvp_tasks.md` (task list).
> Status words: **Built** = in code, unit- and browser-tested with mocked APIs, not yet run on a live Wix store. **Planned** = agreed, not started. **Exploring** = idea only.
> Rule: the Plan page in the app shows "(coming soon)" next to anything not built. We never sell a feature that does not exist.

---

## 1. Who we compete with

Main paid rival on Wix: **Fera** (fera.ai/pricing, read 13 Oct 2026). The free baseline is Wix's own **Wix Reviews** app.

| | Fera | Product Reviews (us) |
|---|---|---|
| Free plan | No (trial only) | **Yes: 50 requests / month, forever** |
| Entry paid plan | Startup $9: 100 review requests, 200 orders, 100 MB media | Starter $9: **300 requests** |
| Mid plan | Small $29: 1,000 requests, AI replies | Pro $29: **1,500 requests** (AI replies planned) |
| Large plan | Medium $99: 10,000 requests; up to $999 Enterprise | Growth $79: **10,000 requests** |
| Photo / video reviews | Yes | Photos built (needs R2 switched on); video planned (Pro) |
| AI moderation / replies | Yes | Rule-based spam check built (Free); AI replies planned (Pro) |
| Q&A, media gallery, store rating | Yes | Store rating on Overview built; carousel + all-reviews page built; Q&A planned |
| Ratings in Google search / Shopping | Yes | JSON-LD planned for launch (R13); Shopping feed planned (Pro) |
| Incentives (discount, loyalty) | Yes | Thank-you coupon built (Starter), labelled as incentive |
| Follow-up emails | Yes | One reminder built (Starter) |
| SMS, custom email domain, multi-language, hide branding | Higher plans | Planned (Growth) |

**Where we win today**

1. A real Free plan. Fera has none; Wix Reviews is free but basic.
2. More requests per dollar at every tier (3x at $9, 1.5x at $29).
3. Light storefront: the reviews section is plain HTML, about 12 KB with 1 KB of script. Fast pages help SEO and conversion.
4. Honest by design: no rating gating, incentive labels, unsubscribe in every email, policy text the merchant can copy. This keeps merchants clear of FTC / UK DMCC trouble.
5. Merchant owns the data: CSV export any time on every plan; one-click import from Wix Reviews or CSV.

**Where Fera is ahead (gaps to close)**

Video reviews, AI replies and summaries, Q&A, Google Shopping ratings, SMS, multi-language, custom sender domain, a theme-matched widget out of the box.

## 2. Plan ladder (what each plan gets)

Limits from `lib/plans.ts`; feature gates from `lib/features.ts` (one table, checked again on the server when a feature runs).

| Feature | Free | Starter $9 | Pro $29 | Growth $79 | Status |
|---|---|---|---|---|---|
| Review requests / month | 50 | 300 | 1,500 | 10,000 | Built |
| Automatic request after fulfilment, delay 1–60 days | ✓ | ✓ | ✓ | ✓ | Built |
| Multi-product review form, verified buyer badge | ✓ | ✓ | ✓ | ✓ | Built |
| Product reviews section: sort, **star filter**, **"Helpful" votes**, Read more | ✓ | ✓ | ✓ | ✓ | Built |
| **Star rating badge** (near product title) | ✓ | ✓ | ✓ | ✓ | Built |
| **Spam check** (links, contact details, abuse, shouting, repeats; holds review even with auto-publish) | ✓ | ✓ | ✓ | ✓ | Built |
| **Daily new-review email** to the owner | ✓ | ✓ | ✓ | ✓ | Built |
| **Send me a test email** (sample form, saves nothing) | ✓ | ✓ | ✓ | ✓ | Built |
| **Ask recent customers** (orders fulfilled in last 30 days, once a day) | ✓ | ✓ | ✓ | ✓ | Built |
| Import (Wix Reviews, CSV), export CSV | ✓ | ✓ | ✓ | ✓ | Built |
| Photo reviews | ✓ | ✓ | ✓ | ✓ | Built, off until R2 is set up |
| **One reminder** 7 days after the request | – | ✓ | ✓ | ✓ | Built |
| **Thank-you coupon** (5–50%, single use, 90 days, any rating) | – | ✓ | ✓ | ✓ | Built |
| **Reviews carousel** (home page) and **all-reviews page** | – | ✓ | ✓ | ✓ | Built |
| Theme-matched widget (site fonts and colours) | ✓ | ✓ | ✓ | ✓ | Planned, phase 2 |
| Video reviews | – | – | ✓ | ✓ | Planned, phase 3 |
| AI reply drafts + "what customers say" summary | – | – | ✓ | ✓ | Planned, phase 3 |
| Product Q&A | – | – | ✓ | ✓ | Planned, phase 3 |
| Star ratings in Google Shopping (product ratings feed) | – | – | ✓ | ✓ | Planned, phase 3 |
| Emails in the customer's language (Hindi first) | – | – | – | ✓ | Planned, phase 4 |
| Send from the store's own email domain | – | – | – | ✓ | Planned, phase 4 |
| Priority support | – | – | – | ✓ | Process, not code |

Why Free stays generous: every Free feature above is cheap to run (rules, SQL, one daily email). Paid features either cost us money per use (emails, AI, storage, Wix coupon calls) or are clear "growth" tools merchants pay for.

## 3. Phases

### Phase 0 — MVP extras (done in code, 14 Oct 2026)
Everything marked **Built** above. Needs migration `0007` (helpful votes, reminder and coupon columns) on Neon and a live-store check.

### Phase 1 — Launch (founder + Wix app dashboard)
- Register site plugins / widgets: product reviews (`/widget`), rating badge (`/widget/badge`), carousel (`/widget/carousel`), all-reviews page (`/widget/all`).
- Permissions: Read Orders (backfill), Manage Coupons (thank-you coupon), plus the existing catalog, site and reviews permissions.
- R2 bucket + CORS so photo uploads switch on.
- JSON-LD for Google review snippets (R13) once the test store is published.
- Live test on the V3 test store: install → order → email → review → widget → reminder → coupon → digest → uninstall.

### Phase 2 — Theme-matched storefront (Free, biggest gap vs Fera)
- Move the product reviews section from an iframe to a **custom element site plugin**. It then reads the site theme (`--wst-color-*`, `--wst-font-style-*`, `getSiteThemeHtml()`), so fonts and colours match without settings.
- Keep the plain-HTML approach and size budget (under 15 KB).
- Editor panel with colour and font pickers that default to the theme.
- Needs a live store to test; do after Phase 1.

### Phase 3 — Pro value
- **AI reply drafts and review summary** with a small model (Claude Haiku class). Token rules: summary rebuilt only when 5+ new reviews arrive, cached per product; reply draft only on click; input clipped to the review text. Target under $0.01 per store per day.
- **Video reviews**: upload to R2 with size and length caps; poster frame; same moderation.
- **Product Q&A**: shopper asks, merchant answers, shown under reviews; same spam check.
- **Google Shopping product ratings feed** (XML from published reviews) plus seller ratings guidance.

### Phase 4 — Growth value
- Request and reminder emails in the shopper's language (Hindi, then Spanish, French, German).
- Custom sender domain via Resend domain verification (merchant adds DNS records).
- Exploring: WhatsApp / SMS requests (cost per message, consent rules), hide "made by" footer.

## 4. Pricing stance

- Keep **more requests per dollar** than Fera at every tier; that is the easiest message for merchants to check.
- Keep a **useful Free plan** forever. It is our install engine on the Wix App Market.
- Do not raise Pro to Fera's $29 feature set until AI replies and video are **built and tested**. Until then the Plan page shows them as "coming soon".
- Review prices after 50 paying stores, using real email and AI cost per store.

## 5. Rules we will not break (also our marketing)

- No rating gating: the same request goes to everyone, auto-publish applies to every rating, the spam check looks at content only.
- Incentives are for any honest review and the review is labelled "Received an incentive".
- Carousel and all-reviews page show every rating, newest first, never highlights only.
- Every email has an unsubscribe link and the store's postal address.
- The merchant can export all reviews on every plan.
