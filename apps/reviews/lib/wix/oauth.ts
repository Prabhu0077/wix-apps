// Wix OAuth for self-managed apps (the only flow new apps get).
// The app mints a short-lived token for one site from its App ID, App Secret
// and that site's instanceId. No install redirect, no refresh tokens.
//
// Docs (read 14 Oct 2026):
//   https://dev.wix.com/docs/build-apps/develop-your-app/access/authentication/authenticate-as-an-app-instance
//   POST https://www.wixapis.com/oauth2/token       { grant_type: "client_credentials", client_id, client_secret, instance_id }
//   POST https://www.wixapis.com/oauth2/token-info  { token } -> { instanceId, ... }

import { env } from "../env";

const TOKEN_URL = "https://www.wixapis.com/oauth2/token";
const TOKEN_INFO_URL = "https://www.wixapis.com/oauth2/token-info";

export interface AppToken {
  accessToken: string;
  expiresAt: number; // ms epoch
}

/** Body for Create Access Token. Exported for tests. */
export function appTokenRequest(instanceId: string) {
  return {
    grant_type: "client_credentials",
    client_id: env.WIX_APP_ID,
    client_secret: env.WIX_APP_SECRET,
    instance_id: instanceId,
  };
}

/** Mint an app-identity token for one site. Valid about 4 hours. */
export async function createAppToken(instanceId: string, now = Date.now()): Promise<AppToken> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(appTokenRequest(instanceId)),
  });
  if (!res.ok) {
    // Never echo the request body (it holds the secret).
    const body = await res.text().catch(() => "");
    throw new Error(`Wix token request failed: ${res.status} ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Wix token response had no access_token");
  const ttlSec = typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 4 * 60 * 60;
  return { accessToken: data.access_token, expiresAt: now + ttlSec * 1000 };
}

/**
 * Which site a Wix access token belongs to. Used by the storefront custom
 * element, which can only send us a visitor-scoped Wix token. Returns null
 * for a bad or expired token.
 */
export async function instanceIdFromToken(token: string): Promise<string | null> {
  const t = token.replace(/^Bearer\s+/i, "").trim();
  if (!t || t.length > 4096) return null;
  const res = await fetch(TOKEN_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: t }),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json().catch(() => null)) as { instanceId?: string } | null;
  return typeof data?.instanceId === "string" && data.instanceId ? data.instanceId : null;
}
