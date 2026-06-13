# App #1 — Visual UGC & Video Reviews (Wix-Native)

> Loox/Yotpo-class photo & video reviews for Wix Stores. First app in the portfolio. See `Wix_Apps_Portfolio.md` for context.

**Status:** spec
**Build target:** 6–8 weeks (solo / 1–3 person team)
**Pricing model:** Freemium → paid upgrades

---

## 1. Problem & Wedge

Wix's built-in Reviews app is text + star ratings. There is no Wix-native equivalent of Loox or Yotpo's photo/video-review widgets, no shoppable video walls, no AI moderation, no review importer. Visual reviews lift conversion 10–30% in published case studies — the gap is real and pays for itself on day one for merchants who install.

**Wedge for us specifically:** importer from Loox / Yotpo / Aliexpress. Merchants migrating from Shopify to Wix (or running both) bring years of reviews with them. We're the only app that lets them keep that data.

---

## 2. Target Customer (ICP)

- **Wix Stores merchants with 50+ products and >$5K/mo GMV.**
- Apparel, beauty, home goods, accessories, consumables — categories where photos matter.
- Often dual-platform (also have a Shopify store) — they already pay for Loox/Yotpo there.
- Pain: their Wix store has no visual social proof; they're losing PDP conversions vs. their Shopify competitors.

---

## 3. MVP Scope (8 Weeks)

### Must-have (ship at launch)

1. **Post-purchase review request** — email + optional SMS, triggered by Wix `Order Fulfilled` webhook (delay configurable: 7 / 14 / 21 days after fulfillment).
2. **Photo + video review submission** — public link (no login required) that hosts a one-page form with star rating, text, up to 5 photos, 1 video (max 60s, transcoded).
3. **PDP review widget** — embeddable JavaScript that injects a star-summary block at the top of product pages and a full review list further down. Carousel for photos/videos.
4. **Merchant moderation dashboard** — list view, approve / reject / reply, auto-flag for profanity (regex + simple LLM check), filter by rating.
5. **AI moderation** — auto-flag potentially spam/profanity reviews; merchant approves.
6. **Wix App Market billing** — three tiers wired up to Wix Pricing & Plans:
   - **Free** — text + photo, up to 50 review requests / month
   - **Pro $29/mo** — unlimited requests, video reviews, PDP carousel
   - **Growth $79/mo** — shoppable video wall, AI moderation, multi-language requests, importer

### Should-have (post-launch, weeks 9–12)

7. Importer from Loox / Yotpo / Judge.me (CSV first, API second).
8. Star schema (`AggregateRating` JSON-LD) injected on PDPs for SEO.
9. Shoppable video wall page (`<ShoppableVideoWall />` widget).
10. Reply templates + AI-suggested replies.

### Won't-have (v1)

- Q&A on products (separate scope).
- Multi-currency display in widget (use store currency).
- Native mobile app for merchants — dashboard is web-only.
- TikTok / Instagram Reels import — backlog after launch.

---

## 4. Data Model (Drizzle, simplified)

> ORM: **Drizzle** (locked 2026-05-21). Migrations via `drizzle-kit`. Driver: `@neondatabase/serverless` for HTTP-first connections from Vercel.

```ts
// drizzle/schema.ts
import { pgTable, pgEnum, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export const planEnum          = pgEnum('plan',            ['FREE', 'PRO', 'GROWTH']);
export const subStatusEnum     = pgEnum('sub_status',      ['ACTIVE', 'PAST_DUE', 'CANCELLED']);
export const requestStatusEnum = pgEnum('request_status',  ['SCHEDULED', 'SENT', 'OPENED', 'COMPLETED', 'EXPIRED']);
export const reviewStatusEnum  = pgEnum('review_status',   ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN']);
export const mediaKindEnum     = pgEnum('media_kind',      ['PHOTO', 'VIDEO']);

// --- shared shell tables (extract to packages/db when app #2 arrives) ---

export const accounts = pgTable('accounts', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  wixInstanceId: text('wix_instance_id').unique().notNull(),
  siteId:        text('site_id').notNull(),
  ownerEmail:    text('owner_email').notNull(),
  installedAt:   timestamp('installed_at').defaultNow().notNull(),
  plan:          planEnum('plan').default('FREE').notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id:         text('id').primaryKey().$defaultFn(() => createId()),
  accountId:  text('account_id').references(() => accounts.id).notNull(),
  wixOrderId: text('wix_order_id').unique().notNull(),
  plan:       planEnum('plan').notNull(),
  status:     subStatusEnum('status').notNull(),
  renewsAt:   timestamp('renews_at'),
});

// --- reviews-app-specific tables ---

export const reviewRequests = pgTable('review_requests', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  accountId:     text('account_id').references(() => accounts.id).notNull(),
  wixOrderId:    text('wix_order_id').notNull(),
  customerEmail: text('customer_email').notNull(),
  productIds:    jsonb('product_ids').$type<string[]>().notNull(),
  status:        requestStatusEnum('status').notNull(),
  scheduledFor:  timestamp('scheduled_for').notNull(),
  sentAt:        timestamp('sent_at'),
  publicToken:   text('public_token').unique().notNull(),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  accountId:       text('account_id').references(() => accounts.id).notNull(),
  productId:       text('product_id').notNull(),
  wixOrderId:      text('wix_order_id'),
  customerName:    text('customer_name').notNull(),
  customerEmail:   text('customer_email').notNull(),
  rating:          integer('rating').notNull(),                                      // 1-5
  body:            text('body').notNull(),
  status:          reviewStatusEnum('status').notNull(),
  moderationFlags: jsonb('moderation_flags').$type<string[]>().default([]).notNull(),
  reply:           text('reply'),
  publishedAt:     timestamp('published_at'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
});

export const reviewMedia = pgTable('review_media', {
  id:        text('id').primaryKey().$defaultFn(() => createId()),
  reviewId:  text('review_id').references(() => reviews.id).notNull(),
  kind:      mediaKindEnum('kind').notNull(),
  r2Key:     text('r2_key').notNull(),                                                // Cloudflare R2 object key
  publicUrl: text('public_url').notNull(),
  thumbUrl:  text('thumb_url'),
  width:     integer('width'),
  height:    integer('height'),
  durationS: integer('duration_s'),
});

// Relations (used for Drizzle's relational query API)
export const reviewsRelations     = relations(reviews,     ({ many }) => ({ media: many(reviewMedia) }));
export const reviewMediaRelations = relations(reviewMedia, ({ one  }) => ({
  review: one(reviews, { fields: [reviewMedia.reviewId], references: [reviews.id] }),
}));
```

---

## 5. Wix APIs & Webhooks Used

| Capability | Wix surface |
|---|---|
| App install / OAuth | Wix App Instance + OAuth flow |
| Order fulfilled trigger | Webhook: `Order Fulfilled` (`wix.ecom.v1.order.fulfilled`) |
| Order paid trigger (optional alt) | Webhook: `Payment Status Updated` |
| Product metadata | Wix Stores Products REST API (to display product names/images in widget) |
| Site-side widget injection | Wix App Market — Site App (Embedded Script Tag widget) |
| Merchant dashboard surface | Wix App Market — Dashboard App (iframe) |
| Pricing tiers + paid plans | Wix App Market billing (`AppInstance` plan property + plan webhooks) |
| Media uploads | Cloudflare R2 directly via signed URL — keep media in our infra, not Wix's (cheaper, easier transcoding) |
| JSON-LD on PDPs | Wix Custom Code (injected via widget) |

**Why R2 instead of Wix Media Manager:** zero egress fees, easier video transcoding pipeline, owns the data if we want to add a TikTok-style feed later. Wix Media Manager is a fine fallback if R2 ever blocks us.

---

## 6. Architecture (Reviews app — first app, no shared packages yet)

```
apps/reviews/
├── app/
│   ├── (dashboard)/                    # Merchant-facing dashboard, mounted in Wix iframe
│   │   ├── reviews/page.tsx
│   │   ├── settings/page.tsx
│   │   └── billing/page.tsx
│   ├── api/
│   │   ├── wix/install/route.ts        # OAuth callback
│   │   ├── wix/webhook/route.ts        # All Wix webhook events fan out here
│   │   ├── public/review/[token]/route.ts  # Public review submission form API
│   │   └── widget/products/[id]/route.ts   # Widget data endpoint
│   └── widget/                         # The injectable JS that renders on storefront PDPs
│       └── reviews-widget.tsx
├── lib/                                # All extraction candidates — keep clean module boundaries
│   ├── wix/
│   │   ├── client.ts                   # Wix SDK / REST wrapper
│   │   ├── webhooks.ts                 # Webhook signature verification + router
│   │   └── oauth.ts                    # Install / token refresh
│   ├── billing/
│   │   └── plans.ts                    # Plan-state lookup + upgrade webhook handlers
│   ├── media/
│   │   ├── r2.ts                       # Signed URL generation, upload helpers
│   │   └── transcode.ts                # FFmpeg worker (async, queue-based)
│   ├── moderation/
│   │   └── ai.ts                       # OpenAI/Anthropic moderation check
│   ├── email/postmark.ts               # Transactional sender
│   ├── sms/twilio.ts                   # SMS sender
│   └── db.ts                           # Drizzle client (Neon serverless driver)
├── workers/
│   ├── send-review-requests.ts         # Cron: scan ReviewRequest, send when due
│   └── transcode-video.ts              # Queue: convert uploaded video to web-friendly mp4
└── drizzle/
    ├── schema.ts                       # see Section 4
    └── migrations/                     # generated by drizzle-kit
```

Each `lib/X/` folder is **self-contained**. When app #2 (Loyalty) needs the same wrapper, that's the signal to extract it into `packages/X/`.

---

## 7. Build Plan — Week by Week

### Week 1 — Foundation
- Monorepo scaffold (pnpm + Turborepo). `apps/reviews` Next.js app boots.
- Drizzle schema (`drizzle/schema.ts`) for Account, Subscription, ReviewRequest, Review, ReviewMedia; first migration generated and applied via `drizzle-kit`.
- **Neon** Postgres project created (main branch = prod, dev branch for local). `@neondatabase/serverless` driver wired into `lib/db.ts`. Cloudflare R2 bucket + Postmark + Twilio accounts created.
- Wix Developer Center app registered. OAuth install flow stubbed.

### Week 2 — Install & Webhooks
- Complete OAuth install + uninstall flow. Account row created on install.
- Webhook handler for `Order Fulfilled` and `Payment Status Updated`. Verified signatures. ReviewRequest rows scheduled.
- Internal admin page lists installs and webhook events received.

### Week 3 — Review Request Pipeline
- Cron worker scans `ReviewRequest WHERE scheduledFor <= now() AND status = SCHEDULED` every 5 min.
- Postmark template for the request email (brand-configurable).
- Public review submission page (no auth) — star rating, text, photo upload to R2 via signed URL.
- Review row created on submission. Mark request as COMPLETED.

### Week 4 — Video + Moderation
- Video upload to R2 with signed URL. Background worker transcodes to web mp4 (FFmpeg in a Railway worker).
- AI moderation: send incoming review text to a small LLM for profanity / spam classification. Auto-flag suspect reviews.
- Merchant moderation queue UI in dashboard: list, approve, reject, reply.

### Week 5 — PDP Widget
- Embeddable JS widget. Loaded from our CDN; takes site/product ID, fetches reviews JSON from our API, renders star summary + scrollable photo/video carousel + review list.
- Lighthouse pass: lazy-loads media, <30KB initial widget JS.
- Wix Custom Code installation flow: when merchant installs, we add the widget script to all PDPs automatically.

### Week 6 — Billing + Plan Enforcement
- Wix App Market billing plans configured (Free / Pro / Growth).
- Plan-change webhook handler updates `Subscription` row.
- Plan gating: free tier limited to 50 ReviewRequests/month, no video, no carousel.
- Upgrade CTA in dashboard at the right moments (when limit hit, when merchant tries to enable video).

### Week 7 — Polish + Launch Prep
- Brand customization (logo, colors, email template editor).
- Multi-language email templates (en + es + fr at launch).
- Cookie/privacy compliance for widget.
- App listing copy + screenshots + demo video.
- Internal soak: 10 friendly Wix merchants installed in beta.

### Week 8 — Submit & Launch
- Submit to Wix App Market review.
- Address review feedback (typically 1 round, 3–5 day cycle).
- Launch announcement: ProductHunt, Reddit r/wix, Wix developer forum, Twitter.
- Monitor: install rate, free → paid conversion, time-to-first-review per install.

---

## 8. Pricing & Upgrade Triggers

| Tier | Price | Limits | Trigger to upgrade |
|---|---|---|---|
| Free | $0 | 50 review requests/mo, text + photo, basic widget | Hits 50 requests OR wants video |
| Pro | $29/mo | Unlimited requests, video reviews, PDP carousel | Wants AI moderation OR multi-language OR shoppable video wall |
| Growth | $79/mo | All of Pro + shoppable video wall, AI moderation, multi-lang, importer | Outgrows; rare to leave |

**Free trial:** 14-day Pro trial automatically on install. Reverts to Free if no upgrade.

**Annual plans:** 2 months free if billed annually (Pro $290/yr, Growth $790/yr).

---

## 9. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Wix ships native video reviews. | Go deep on shoppable video walls + importer — Wix won't prioritize those soon. |
| Video transcoding cost balloons. | R2 + on-demand FFmpeg (Railway worker). Cap free video to 30s, Pro to 60s. |
| Widget kills site Lighthouse score. | Strict bundle budget (<30KB), lazy-load all media, defer non-critical JS. |
| Email deliverability tanks (review requests look spammy). | Use Postmark + verified merchant domain via DKIM. Allow merchants to send-from their own domain. |
| Low free → paid conversion. | Force upgrade triggers at high-pain moments (50-request limit, video toggle, shoppable wall). |
| Wix App Market approval delays. | Soft-launch with 10 hand-picked merchants via unlisted install URL while approval pends. |

---

## 10. Decisions Log

### Locked in (2026-05-21)

- **Postgres host: Neon.** Branching for preview environments is a killer feature for testing Wix webhook handlers without trashing prod data. Serverless scaling matches our spiky workload (cron + webhook bursts). The auth/storage features Supabase bundles are wasted on us — we use Wix OAuth and Cloudflare R2.
- **ORM: Drizzle.** Better cold-start performance for webhooks (Wix retries slow responses). SQL-fluent style fits the aggregation queries we'll write for review averages and counts. Edge-runtime compatible — important if we later move the widget data endpoint to the edge for global latency. `drizzle-kit` handles migrations; less hand-holding than Prisma but good enough for our scale.
- **Free-tier cap: 50 review requests / month.** Tight enough to fire an upgrade trigger on hooked merchants without scaring off early-stage stores. Loox's 100/mo cap is calibrated for an app with no other upgrade triggers; we also have the "want to enable video" trigger on the Pro tier, so the cap can be tighter without hurting conversion. Revisit at 90 days: if free→paid is under 3%, raise to 75; if over 6%, drop to 25.

### Open (to resolve before launch)

- [ ] **Launch domain name** — defer until Week 6 once product voice is clear. Internal codename in repo + Slack is fine for now. Placeholder shortlist if we want to register a cheap .com / .app this week: **Reelproof, Vouchly, Pixly, Visia, Trustlens.**
- [ ] **First beta merchants** — pick the *channel*, not the names. Week 2 outreach plan: (1) existing Shopify network — anyone running a Wix sister site; (2) short r/wix Reddit post offering Growth-tier-for-life to first 10 beta installers; (3) scan 1–2 star reviews of competing apps in the Wix App Market and reach out to those merchants. Target: 10 active installs by end of Week 4.

---

## 11. Success Definition

**MVP is a success if, 90 days after public launch:**

- 500+ installs (free + paid combined)
- 25+ paying merchants (Pro or Growth)
- $1K+ MRR
- 4.5+ stars on the Wix App Market listing
- 2+ merchant case studies showing conversion-rate lift

**Stretch (180 days):** $5K MRR, 100+ paying merchants, ranked top-3 in Wix App Market Reviews category. At that point, start Loyalty 2.0 (app #2) with reviews-app revenue funding the build.

---

## Appendix — Wix API References

- Order Fulfilled webhook: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/order-fulfilled
- Payment Status Updated webhook: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/payment-status-updated
- Wix Stores Products API: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/introduction
- App Market billing: https://dev.wix.com/docs/build-apps/launch-your-app/pricing-and-billing/about-monetizing-your-app
- Wix Custom Code: https://support.wix.com/en/article/about-custom-code
- Wix App Instance API: https://dev.wix.com/docs/rest/api-reference/app-management/apps/app-instance/introduction
