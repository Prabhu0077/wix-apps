// The store's public business details from Wix Site Properties (task T1.4):
// the name shoppers know the store by, and the postal address that
// CAN-SPAM requires in commercial email (the merchant is the sender).
//
// Docs (checked 13 Oct 2026): GET https://www.wixapis.com/site-properties/v4/properties
// -> properties.{businessName, siteDisplayName, address{...}}. Permission
// scope: "Manage Your App". Merchants edit these in Wix: Settings > Business Info.

import type { WixClient } from "./client";

export type StoreProfile = { storeName: string | null; storeAddress: string | null };

type WixAddress = {
  street?: string;
  streetNumber?: string;
  apartmentNumber?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  googleFormattedAddress?: string;
  hint?: { text?: string; placement?: "BEFORE" | "AFTER" | "REPLACE" };
};

type PropertiesResponse = {
  properties?: { businessName?: string; siteDisplayName?: string; address?: WixAddress };
};

const URL =
  "https://www.wixapis.com/site-properties/v4/properties" +
  "?fields.paths=businessName&fields.paths=siteDisplayName&fields.paths=address";

const clean = (s: string | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

/** One-line postal address, or null if Wix has nothing usable. */
export function formatAddress(a: WixAddress | undefined): string | null {
  if (!a) return null;
  if (a.hint?.placement === "REPLACE" && clean(a.hint.text)) return clean(a.hint.text);
  const google = clean(a.googleFormattedAddress);
  if (google) return google;
  const line1 = [clean(a.streetNumber), clean(a.street)].filter(Boolean).join(" ");
  const parts = [
    line1,
    clean(a.apartmentNumber),
    clean(a.city),
    [clean(a.state), clean(a.zip)].filter(Boolean).join(" "),
    clean(a.country),
  ].filter(Boolean);
  // A country alone is not a postal address.
  return parts.length >= 2 ? parts.join(", ") : null;
}

export function profileFrom(res: PropertiesResponse | undefined): StoreProfile {
  const p = res?.properties;
  return {
    storeName: clean(p?.businessName) || clean(p?.siteDisplayName) || null,
    storeAddress: formatAddress(p?.address),
  };
}

export async function fetchStoreProfile(client: WixClient): Promise<StoreProfile> {
  return profileFrom(await client.get<PropertiesResponse>(URL));
}
