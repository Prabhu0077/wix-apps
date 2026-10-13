import type { Metadata } from "next";

import { MAKER_LOCATION, MAKER_NAME, MAKER_URL, PRIVACY_EMAIL, PRODUCT_NAME, REVIEW_LINK_DAYS } from "@/lib/product";

export const metadata: Metadata = {
  title: `Privacy policy — ${PRODUCT_NAME}`,
  description: `How ${PRODUCT_NAME} collects, uses and protects data.`,
};

// Review with a lawyer before App Market submission. Keep the processor list
// in sync with the services actually used.
const LAST_UPDATED = "13 October 2026";

export default function PrivacyPage() {
  return (
    <main className="doc">
      <h1>Privacy policy</h1>
      <p className="doc-meta">
        {PRODUCT_NAME} for Wix. Last updated {LAST_UPDATED}.
      </p>

      <h2>Who we are</h2>
      <p>
        {PRODUCT_NAME} is a Wix app made and run by {MAKER_NAME}, a registered micro enterprise (MSME) in {MAKER_LOCATION}.
        It helps Wix store owners collect, check and show reviews of their products. Contact:{" "}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>
      <p>
        For shoppers&apos; data, the store owner decides why it is collected and we process it for them. For store owners&apos;
        own account data, we are responsible.
      </p>

      <h2>What we collect</h2>
      <p>From store owners who install the app:</p>
      <ul>
        <li>Wix site and app instance IDs, to know which store a request belongs to</li>
        <li>The account email Wix shares with us, for service messages</li>
        <li>Access tokens from Wix, stored encrypted, to read orders and products</li>
        <li>App settings you choose</li>
      </ul>
      <p>From shoppers who leave a review:</p>
      <ul>
        <li>Email address and order products, from the store&apos;s Wix order, to send one review request</li>
        <li>The name, rating, text and any photos they submit</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To send review request emails on the store&apos;s behalf</li>
        <li>To show published reviews on the store&apos;s product pages, with the shopper&apos;s chosen name only</li>
        <li>To give the store owner a dashboard to manage reviews</li>
        <li>To check the app is working and fix problems</li>
      </ul>
      <p>
        We never sell data, never use shoppers&apos; details for our own marketing, and never build contact lists from
        stores&apos; customers.
      </p>

      <h2>Who we share it with</h2>
      <p>Only with services that run the app, under data-processing terms:</p>
      <ul>
        <li>Wix — the platform, orders and billing</li>
        <li>Neon — database hosting</li>
        <li>Vercel — application hosting</li>
        <li>Resend — sending emails</li>
        <li>Cloudflare — photo storage (when photo reviews are enabled)</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Reviews and photos: while the app is installed, then deleted within 30 days of uninstall</li>
        <li>Review requests: while the app is installed; each review link stops working after {REVIEW_LINK_DAYS} days</li>
        <li>Store owner account data: deleted within 30 days of uninstall</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Store owners and shoppers can ask for a copy of their data, a correction or deletion, and can object to processing.
        Email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>; we reply within 30 days. Shoppers can also ask the
        store directly.
      </p>

      <h2>Security</h2>
      <p>
        Access tokens are encrypted at rest (AES-256-GCM). All traffic uses HTTPS. Only {MAKER_NAME} staff who need access
        to fix a problem can reach production data.
      </p>

      <h2>Cookies</h2>
      <p>The app sets no tracking or advertising cookies.</p>

      <h2>Children</h2>
      <p>The app is for businesses and is not aimed at children.</p>

      <h2>Changes</h2>
      <p>We&apos;ll email store owners before any important change to this policy.</p>

      <p className="doc-foot">
        <a href={MAKER_URL}>{MAKER_NAME}</a>, {MAKER_LOCATION}. <a href="/support">Help</a>
      </p>
    </main>
  );
}
