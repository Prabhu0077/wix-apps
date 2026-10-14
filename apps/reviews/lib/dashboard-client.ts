"use client";

// Small helpers for dashboard pages: read the signed Wix instance from the
// URL and call our dashboard APIs with it. Errors come back as plain
// sentences the merchant can act on.

import { useSearchParams } from "next/navigation";

export function useInstance(): string | null {
  return useSearchParams().get("instance");
}

const ERROR_TEXT: Record<string, string> = {
  unauthorized: "Open this page from your Wix dashboard so we can confirm your site.",
  account_not_found: "We couldn't find this site. Reinstall the app from the Wix App Market.",
  too_soon: "You just did that. Try again a little later.",
  no_owner_email: "We don't have your email address yet. Reopen the app from your Wix dashboard and try again.",
  email_failed: "The email didn't send. Try again in a few minutes.",
  wix_unavailable: "We couldn't reach your Wix orders just now. Try again in a few minutes.",
};

export class ApiError extends Error {}

export async function api<T>(
  instance: string | null,
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH"; body?: Record<string, unknown> },
): Promise<T> {
  if (!instance) throw new ApiError(ERROR_TEXT.unauthorized);
  const sep = path.includes("?") ? "&" : "?";
  const url = `${path}${sep}instance=${encodeURIComponent(instance)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify({ ...init.body, instance }) : undefined,
    });
  } catch {
    throw new ApiError("We couldn't reach the server. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new ApiError(ERROR_TEXT[data.error ?? ""] ?? "Something went wrong on our side. Try again in a minute.");
  }
  return data;
}

