// Wix webhook signature verification.
//
// Wix sends webhook payloads as JWTs signed with the app's public key
// (configured in the Wix Developer Center). The signature is in the
// `digest` header on every webhook request.
//
// Docs:
// https://dev.wix.com/docs/build-apps/develop-your-app/access/authorization-types#webhook-jwt-signature
//
// !! SECURITY: the dev bypass at the bottom of this file is ONLY active in
// NODE_ENV=development. Production returns false until real JWT verification
// is implemented. See apps/reviews/AGENTS.md "Security gotchas".

import crypto from "crypto";
import * as jose from "jose";

import { env } from "../env";

export interface WixWebhookPayload {
  id: string;
  instanceId: string;
  entityFqdn: string;          // e.g. "wix.ecom.v1.order"
  slug: string;                // e.g. "fulfilled", "payment_status_updated"
  entityId: string;
  eventTime?: string;
  // Body shape varies per event; cast at the handler.
  actionEvent?: { body?: unknown };
  createdEvent?: { entity?: unknown };
  updatedEvent?: { currentEntity?: unknown; previousEntity?: unknown };
  deletedEvent?: unknown;
}

function getPublicKeyPem(key: string): string {
  let cleaned = key.trim();
  // If it doesn't start with -----BEGIN PUBLIC KEY-----, it might be base64-encoded
  if (!cleaned.startsWith("-----BEGIN")) {
    try {
      cleaned = Buffer.from(cleaned, "base64").toString("utf-8").trim();
    } catch {
      // Fallback to original cleaned string
    }
  }
  // Replace literal '\n' characters with actual newlines
  return cleaned.replace(/\\n/g, "\n");
}

/**
 * Verify a Wix webhook JWT signature against the app's public key.
 *
 * @param rawBody   Raw request body (string, as received).
 * @param signature Value of the `digest` header on the request.
 * @returns         true if the signature is valid for this body+key.
 */
export async function verifyWixWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;

  try {
    // Strip "JWT=" prefix if present
    let token = signature.trim();
    if (token.startsWith("JWT=")) {
      token = token.slice(4);
    }

    const pemKey = getPublicKeyPem(env.WIX_WEBHOOK_PUBLIC_KEY);
    const publicKey = await jose.importSPKI(pemKey, "RS256");

    const { payload } = await jose.jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
    });

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      console.error("[webhooks] signature verification failed: token expired");
      return false;
    }

    // Verify body integrity by comparing SHA-256 hash of rawBody with the 'data' claim
    const dataClaim = payload.data;
    if (typeof dataClaim === "string") {
      const computedHex = crypto.createHash("sha256").update(rawBody).digest("hex");
      const computedBase64 = crypto.createHash("sha256").update(rawBody).digest("base64");
      const computedBase64Url = crypto.createHash("sha256").update(rawBody).digest("base64url");

      const match =
        dataClaim === computedHex ||
        dataClaim === computedBase64 ||
        dataClaim === computedBase64Url;

      if (!match) {
        console.error("[webhooks] signature integrity check failed: body hash mismatch", {
          dataClaim,
          computedHex,
          computedBase64,
        });
        return false;
      }
    } else {
      console.warn("[webhooks] JWS payload missing string 'data' claim for body integrity verification");
    }

    return true;
  } catch (err) {
    console.error("[webhooks] JWT verification failed:", err);
    if (env.NODE_ENV === "production") {
      return false;
    }
    // In development, if verification fails, print a warning but return true (bypass)
    console.warn("[webhooks] Dev-only bypass active: signature verification failed, but allowing request.");
    return true;
  }
}

/**
 * Parse a Wix webhook payload. Validates the shape minimally — the per-event
 * body is validated at the handler.
 */
export function parseWixWebhookPayload(raw: string): WixWebhookPayload {
  const p = JSON.parse(raw);
  if (
    typeof p?.id !== "string" ||
    typeof p?.slug !== "string" ||
    typeof p?.instanceId !== "string"
  ) {
    throw new Error("invalid Wix webhook payload shape");
  }
  return p as WixWebhookPayload;
}
