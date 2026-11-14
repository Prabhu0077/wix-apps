// Wix webhook verification for a self-managed app (no Wix JS SDK).
//
// Wix POSTs the webhook as a JWT in the request BODY, signed with the app's
// key (public key from the app dashboard). Verified payload shape:
//   jwt.data            → JSON string { eventType, instanceId, data, identity }
//   jwt.data.data       → JSON string of the event: { id, entityFqdn, slug,
//                          entityId, actionEvent | createdEvent | ... }
// Docs (read 2026-10-13):
//   dev.wix.com/docs/build-apps/develop-your-app/develop-a-self-managed-app/webhooks/handle-events-with-webhooks-for-self-hosting-without-the-java-script-sdk
//   dev.wix.com/docs/api-reference/articles/work-with-wix-apis/platform/about-the-structure-of-webhooks
//
// The previous version read a `digest` header and parsed the body as JSON,
// which does not match how Wix delivers webhooks.
//
// SECURITY: unsigned test payloads are accepted ONLY when
// WIX_WEBHOOK_DEV_BYPASS=1 and NODE_ENV is not production.

import * as jose from "jose";

import { env } from "../env";

export interface WixEvent {
  id: string;
  entityFqdn?: string; // e.g. "wix.ecom.v1.order"
  slug?: string; // e.g. "fulfilled"
  entityId?: string;
  eventTime?: string;
  actionEvent?: { body?: unknown };
  createdEvent?: { entity?: unknown };
  updatedEvent?: { currentEntity?: unknown };
  deletedEvent?: unknown;
  [k: string]: unknown;
}

export interface WixWebhook {
  eventType: string;
  instanceId: string;
  event: WixEvent;
}

let cachedKey: CryptoKey | null = null;

async function publicKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  let pem = env.WIX_WEBHOOK_PUBLIC_KEY.trim();
  if (!pem.startsWith("-----BEGIN")) {
    // Allow the key to be stored base64-encoded in env vars.
    pem = Buffer.from(pem, "base64").toString("utf8").trim();
  }
  pem = pem.replace(/\\n/g, "\n");
  cachedKey = (await jose.importSPKI(pem, "RS256")) as CryptoKey;
  return cachedKey;
}

function parseJsonString<T>(value: unknown): T | null {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toWebhook(envelope: unknown): WixWebhook | null {
  const e = envelope as { eventType?: unknown; instanceId?: unknown; data?: unknown } | null;
  if (!e || typeof e.eventType !== "string" || typeof e.instanceId !== "string") return null;
  // App-instance events (AppInstalled, AppRemoved, ...) carry little or no
  // event data; domain events carry a JSON string.
  const event =
    e.data === undefined || e.data === null || e.data === ""
      ? ({ id: "" } as WixEvent)
      : typeof e.data === "string"
        ? parseJsonString<WixEvent>(e.data)
        : (e.data as WixEvent);
  if (!event || typeof event !== "object") return null;
  return { eventType: e.eventType, instanceId: e.instanceId, event };
}

/**
 * Verify the raw request body (a JWT) and return the decoded webhook, or
 * null if the signature or shape is invalid.
 */
export async function verifyWixWebhook(rawBody: string): Promise<WixWebhook | null> {
  const body = rawBody.trim();

  if (env.WIX_WEBHOOK_DEV_BYPASS === "1" && env.NODE_ENV !== "production" && body.startsWith("{")) {
    console.warn("[webhooks] DEV BYPASS: accepting an unsigned test payload");
    return toWebhook(parseJsonString(body));
  }

  try {
    const { payload } = await jose.jwtVerify(body, await publicKey(), { algorithms: ["RS256"] });
    return toWebhook(parseJsonString(payload.data));
  } catch (err) {
    console.error("[webhooks] signature verification failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
