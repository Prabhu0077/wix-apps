// Verify the signed Wix app `instance` query parameter.
//
// When Wix loads the dashboard iframe it appends ?instance=<signature>.<data>
// where `data` is base64url-encoded JSON ({ instanceId, vendorProductId, ... })
// signed with the app secret (HMAC-SHA256). We verify the signature server-side
// and derive a TRUSTED instanceId — never trust a bare ?instanceId= param.
//
// Docs: https://dev.wix.com/docs/build-apps/develop-your-app/access/app-instances/parse-the-app-instance-query-parameter

import crypto from "crypto";
import { env } from "../env";

export interface WixInstancePayload {
  instanceId: string;
  appDefId?: string;
  vendorProductId?: string; // present only on a paid plan
  permissions?: string;
  [k: string]: unknown;
}

/** Verify a signed Wix instance string and return its payload, or null if invalid. */
export function verifyAppInstance(instance: string | null | undefined): WixInstancePayload | null {
  if (!instance || typeof instance !== "string") return null;
  const dot = instance.indexOf(".");
  if (dot <= 0) return null;

  const sigPart = instance.slice(0, dot);
  const dataPart = instance.slice(dot + 1);

  try {
    const expected = crypto.createHmac("sha256", env.WIX_APP_SECRET).update(dataPart).digest();
    const provided = Buffer.from(sigPart.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      return null;
    }
    const json = Buffer.from(dataPart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as WixInstancePayload;
    return payload?.instanceId ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a trusted instanceId for a dashboard API request.
 * Reads the signed instance from `?instance=` or the `X-Wix-Instance` header.
 * Returns null if missing/invalid (caller should respond 401).
 */
export function resolveInstanceId(
  searchParams: URLSearchParams,
  headerInstance?: string | null,
  bodyInstance?: string | null,
): string | null {
  const signed = searchParams.get("instance") || headerInstance || bodyInstance || null;
  const payload = verifyAppInstance(signed);
  return payload?.instanceId ?? null;
}
