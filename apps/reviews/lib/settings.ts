// Merchant settings stored as jsonb on reviews.accounts.settings.
//
// There is deliberately no "minimum rating to publish" setting: holding back
// low ratings while publishing high ones is review gating, which the FTC
// rule, the UK DMCC Act and Google's review-snippet guidelines treat as
// misleading (PRD v2, R4). Auto-publish applies to every rating equally.

import { z } from "zod";

import { DEFAULT_STAR_COLOR } from "@/lib/product";

export const SettingsSchema = z.object({
  emailDelayDays: z.number().int().min(1).max(60),
  fromName: z.string().trim().min(1).max(60),
  autoPublish: z.boolean(),
  showPhotosFirst: z.boolean(),
  widgetTheme: z.enum(["light", "dark"]),
  starColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  // Email the store owner a daily summary of new reviews.
  notifyNewReviews: z.boolean(),
  // Starter and up: one reminder 7 days after the request if no review yet.
  reminderEnabled: z.boolean(),
  // Starter and up: a one-time discount code for any honest review.
  couponEnabled: z.boolean(),
  couponPercent: z.number().int().min(5).max(50),
});

export type AppSettings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  emailDelayDays: 14,
  fromName: "The store team",
  autoPublish: false,
  showPhotosFirst: false,
  widgetTheme: "light",
  starColor: DEFAULT_STAR_COLOR,
  notifyNewReviews: true,
  reminderEnabled: true,
  couponEnabled: false,
  couponPercent: 10,
};

/** Merge stored jsonb with defaults, dropping anything invalid or retired. */
export function readSettings(stored: unknown): AppSettings {
  const raw = (stored ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    const field = SettingsSchema.shape[key].safeParse(raw[key]);
    if (field.success) merged[key] = field.data;
  }
  return merged as AppSettings;
}

/**
 * Store name for emails and shopper pages. Stored as `storeName` in the same
 * jsonb (set at install, T1.4); not merchant-editable, so not in the schema.
 */
export function storeNameFrom(stored: unknown): string | null {
  const v = (stored as Record<string, unknown> | null | undefined)?.storeName;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
