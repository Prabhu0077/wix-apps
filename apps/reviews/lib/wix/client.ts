// Minimal authenticated Wix REST client.
// Wraps `fetch` with token injection and 401 retry-after-refresh.
//
// Expand this as more endpoints are needed (Products, Members, etc.).

import { refreshAccessToken } from "./oauth";

export interface WixClientOpts {
  accessToken: string;
  refreshToken: string;
  /** Called whenever tokens are refreshed so the caller can persist them. */
  onTokensRefreshed?: (tokens: { accessToken: string; refreshToken: string; expiresInSec: number }) => Promise<void>;
}

export class WixClient {
  private accessToken: string;
  private refreshToken: string;
  private onTokensRefreshed?: WixClientOpts["onTokensRefreshed"];

  constructor(opts: WixClientOpts) {
    this.accessToken = opts.accessToken;
    this.refreshToken = opts.refreshToken;
    this.onTokensRefreshed = opts.onTokensRefreshed;
  }

  async request<T>(method: string, url: string, body?: unknown, retried = false): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.accessToken,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !retried) {
      const fresh = await refreshAccessToken(this.refreshToken);
      this.accessToken = fresh.access_token;
      this.refreshToken = fresh.refresh_token;
      await this.onTokensRefreshed?.({
        accessToken: fresh.access_token,
        refreshToken: fresh.refresh_token,
        expiresInSec: fresh.expires_in,
      });
      return this.request<T>(method, url, body, true);
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Wix API ${method} ${url} failed: ${res.status} ${errBody}`);
    }

    return res.json() as Promise<T>;
  }

  get<T>(url: string)              { return this.request<T>("GET",    url); }
  post<T>(url: string, b: unknown) { return this.request<T>("POST",   url, b); }
  patch<T>(url: string, b: unknown){ return this.request<T>("PATCH",  url, b); }
  delete<T>(url: string)           { return this.request<T>("DELETE", url); }
}
