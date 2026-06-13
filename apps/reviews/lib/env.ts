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

  // Cloudflare R2
  R2_ACCOUNT_ID:        z.string().min(1),
  R2_ACCESS_KEY_ID:     z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET:            z.string().min(1),
  R2_PUBLIC_BASE_URL:   z.string().url(),

  // Email
  RESEND_API_KEY:      z.string().min(1),
  RESEND_FROM_ADDRESS: z.string().email(),

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

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
