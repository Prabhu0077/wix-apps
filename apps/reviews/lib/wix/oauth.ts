// Wix OAuth2 flows.
// Docs: https://dev.wix.com/docs/build-apps/develop-your-app/access/oauth/authorization-code-grant

import { env } from "../env";

const WIX_OAUTH_BASE = "https://www.wixapis.com/oauth";

export interface WixTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;        // seconds
  token_type: "Bearer";
}

/**
 * Exchange an authorization code (returned to /api/wix/install after the user
 * approves the install) for an access + refresh token pair.
 */
export async function exchangeCodeForToken(code: string): Promise<WixTokenResponse> {
  const res = await fetch(`${WIX_OAUTH_BASE}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: env.WIX_APP_ID,
      client_secret: env.WIX_APP_SECRET,
      code,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Wix token exchange failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<WixTokenResponse>;
}

/**
 * Trade a refresh token for a new access token. Access tokens are short-lived
 * (minutes); refresh tokens are long-lived. Call this whenever an API call
 * fails with 401.
 */
export async function refreshAccessToken(refreshToken: string): Promise<WixTokenResponse> {
  const res = await fetch(`${WIX_OAUTH_BASE}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: env.WIX_APP_ID,
      client_secret: env.WIX_APP_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Wix token refresh failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<WixTokenResponse>;
}
