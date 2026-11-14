// Single source of truth for environment variables.
// Validated at boot — fail fast if anything required is missing.
//
// Read env only via this module. Don't sprinkle process.env.X around the app.

import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Wix
  WIX_APP_ID:              z.string().min(1),
  WIX_APP_SECRET:          z.string().min(1),
  WIX_WEBHOOK_PUBLIC_KEY:  z.string().min(1),
  WIX_TOKENS_MASTER_KEY:   z.string().length(64),
  // "1" lets local scripts post unsigned test webhooks. Ignored in production.
  WIX_WEBHOOK_DEV_BYPASS:  z.enum(["1"]).optional(),

  // Cloudflare R2 (optional until R2 billing is activated)
  R2_ACCOUNT_ID:        z.string().min(1).optional(),
  R2_ACCESS_KEY_ID:     z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET:            z.string().min(1).optional(),
  R2_PUBLIC_BASE_URL:   z.string().url().optional(),

  // Email. Optional so the app (widget, form, dashboard) still runs when email
  // is not set up yet; sending fails with a clear error (lib/email/transport.ts).
  // ZeptoMail (Zoho) is used when its token is set, otherwise Resend.
  ZEPTOMAIL_TOKEN:     z.string().min(1).optional(),
  ZEPTOMAIL_API_URL:   z.string().url().optional(),
  EMAIL_FROM_ADDRESS:  z.string().email().optional(),
  RESEND_API_KEY:      z.string().min(1).optional(),
  RESEND_FROM_ADDRESS: z.string().email().optional(),

  // Cron
  CRON_SECRET: z.string().min(16),

  // SMS (optional for v1)
  TWILIO_ACCOUNT_SID:  z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN:   z.string().min(1).optional(),
  TWILIO_FROM_NUMBER:  z.string().min(1).optional(),

  // LLM (at least one of these required for AI moderation; not enforced here — checked at use site)
  OPENAI_API_KEY:    z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // Runtime
  NODE_ENV:                 z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_BASE_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

// Empty strings (e.g. `RESEND_API_KEY=` in .env.local, or a blank Vercel value)
// count as "not set", so optional vars stay optional.
function readProcessEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && v !== "") out[k] = v;
  return out;
}

// Validated on first access, not at import: `next build` imports every route
// to collect page data, and the build machine need not hold runtime secrets.
let parsed: Env | null = null;
export const env: Env = new Proxy({} as Env, {
  get(_t, key) {
    parsed ??= envSchema.parse(readProcessEnv());
    return parsed[key as keyof Env];
  },
});

