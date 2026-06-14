// Drizzle schema for @wix-apps/reviews
// See docs/01_visual_ugc_reviews_mvp_spec.md §4 for context.
//
// Convention: shared shell tables (accounts, subscriptions) are extraction
// candidates for packages/db when app #2 arrives. Reviews-specific tables stay here.

import { text, integer, timestamp, jsonb, index, uniqueIndex, pgSchema } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const reviewsSchema = pgSchema("reviews");

// ---------- Enums ----------

export const planEnum          = reviewsSchema.enum("plan",            ["FREE", "PRO", "GROWTH"]);
export const subStatusEnum     = reviewsSchema.enum("sub_status",      ["ACTIVE", "PAST_DUE", "CANCELLED"]);
export const requestStatusEnum = reviewsSchema.enum("request_status",  ["SCHEDULED", "SENT", "OPENED", "COMPLETED", "EXPIRED"]);
export const reviewStatusEnum  = reviewsSchema.enum("review_status",   ["PENDING", "APPROVED", "REJECTED", "HIDDEN"]);
export const mediaKindEnum     = reviewsSchema.enum("media_kind",      ["PHOTO", "VIDEO"]);

// ---------- Shared shell tables (extraction candidates) ----------

export const accounts = reviewsSchema.table("accounts", {
  id:            text("id").primaryKey().$defaultFn(() => createId()),
  wixInstanceId: text("wix_instance_id").unique().notNull(),
  siteId:        text("site_id").notNull(),
  ownerEmail:    text("owner_email").notNull(),
  installedAt:   timestamp("installed_at").defaultNow().notNull(),
  plan:          planEnum("plan").default("FREE").notNull(),
  wixRefreshToken: text("wix_refresh_token"),
  wixAccessToken:  text("wix_access_token"),
  wixTokenExpiresAt: timestamp("wix_token_expires_at"),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
});

export const subscriptions = reviewsSchema.table("subscriptions", {
  id:         text("id").primaryKey().$defaultFn(() => createId()),
  accountId:  text("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  wixOrderId: text("wix_order_id").unique().notNull(),
  plan:       planEnum("plan").notNull(),
  status:     subStatusEnum("status").notNull(),
  renewsAt:   timestamp("renews_at"),
});

// ---------- Reviews-app-specific tables ----------

export const reviewRequests = reviewsSchema.table(
  "review_requests",
  {
    id:            text("id").primaryKey().$defaultFn(() => createId()),
    accountId:     text("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
    wixOrderId:    text("wix_order_id").notNull(),
    customerEmail: text("customer_email").notNull(),
    productIds:    jsonb("product_ids").$type<string[]>().notNull(),
    status:        requestStatusEnum("status").notNull(),
    scheduledFor:  timestamp("scheduled_for").notNull(),
    sentAt:        timestamp("sent_at"),
    publicToken:   text("public_token").unique().notNull().$defaultFn(() => createId()),
    createdAt:     timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    byAccountStatus: index("rr_account_status_idx").on(t.accountId, t.status),
    byScheduledFor:  index("rr_scheduled_idx").on(t.scheduledFor),
  }),
);

export const reviews = reviewsSchema.table(
  "reviews",
  {
    id:              text("id").primaryKey().$defaultFn(() => createId()),
    accountId:       text("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
    productId:       text("product_id").notNull(),
    wixOrderId:      text("wix_order_id"),
    customerName:    text("customer_name").notNull(),
    customerEmail:   text("customer_email").notNull(),
    rating:          integer("rating").notNull(),                                      // 1-5
    body:            text("body").notNull(),
    status:          reviewStatusEnum("status").notNull(),
    moderationFlags: jsonb("moderation_flags").$type<string[]>().default([]).notNull(),
    reply:           text("reply"),
    publishedAt:     timestamp("published_at"),
    createdAt:       timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    byAccountProduct: index("r_account_product_idx").on(t.accountId, t.productId),
    byStatus:         index("r_status_idx").on(t.status),
  }),
);

export const reviewMedia = reviewsSchema.table("review_media", {
  id:        text("id").primaryKey().$defaultFn(() => createId()),
  reviewId:  text("review_id").references(() => reviews.id, { onDelete: "cascade" }).notNull(),
  kind:      mediaKindEnum("kind").notNull(),
  r2Key:     text("r2_key").notNull(),                                                // Cloudflare R2 object key
  publicUrl: text("public_url").notNull(),
  thumbUrl:  text("thumb_url"),
  width:     integer("width"),
  height:    integer("height"),
  durationS: integer("duration_s"),
});

// ---------- Relations (for Drizzle relational query API) ----------

export const accountsRelations = relations(accounts, ({ many }) => ({
  subscriptions:  many(subscriptions),
  reviewRequests: many(reviewRequests),
  reviews:        many(reviews),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  account: one(accounts, { fields: [subscriptions.accountId], references: [accounts.id] }),
}));

export const reviewRequestsRelations = relations(reviewRequests, ({ one }) => ({
  account: one(accounts, { fields: [reviewRequests.accountId], references: [accounts.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  account: one(accounts, { fields: [reviews.accountId], references: [accounts.id] }),
  media:   many(reviewMedia),
}));

export const reviewMediaRelations = relations(reviewMedia, ({ one }) => ({
  review: one(reviews, { fields: [reviewMedia.reviewId], references: [reviews.id] }),
}));
