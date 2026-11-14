// Minimal authenticated Wix REST client. Gets its token from a provider and,
// on a 401, asks for a fresh one once and retries.

export type TokenProvider = (forceNew: boolean) => Promise<string>;

export class WixClient {
  constructor(private readonly getToken: TokenProvider) {}

  async request<T>(method: string, url: string, body?: unknown, retried = false): Promise<T> {
    const token = await this.getToken(retried);
    const res = await fetch(url, {
      method,
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !retried) return this.request<T>(method, url, body, true);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Wix API ${method} ${url} failed: ${res.status} ${errBody.slice(0, 500)}`);
    }
    return res.json() as Promise<T>;
  }

  get<T>(url: string) {
    return this.request<T>("GET", url);
  }
  post<T>(url: string, b: unknown) {
    return this.request<T>("POST", url, b);
  }
  patch<T>(url: string, b: unknown) {
    return this.request<T>("PATCH", url, b);
  }
  delete<T>(url: string) {
    return this.request<T>("DELETE", url);
  }
}
