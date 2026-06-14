import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — NeoReviewKit",
  description: "How NeoReviewKit collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  const lastUpdated = "June 13, 2026";
  const contactEmail = "chandra.prabhakar12@gmail.com";
  const appName = "NeoReviewKit";
  const company = "NeoNerd";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">{appName} — Privacy Policy</h1>
          <p className="text-slate-400 text-sm mt-1">Last updated: {lastUpdated}</p>
        </div>

        <Section title="1. Who We Are">
          <p>
            {appName} is a Wix App built and operated by {company}. We help Wix merchants collect, moderate,
            and display customer photo reviews on their stores.
          </p>
          <p className="mt-2">
            Contact: <a href={`mailto:${contactEmail}`} className="text-sky-400 hover:underline">{contactEmail}</a>
          </p>
        </Section>

        <Section title="2. What Data We Collect">
          <p className="mb-2 font-medium text-slate-300">From merchants who install the app:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Wix instance ID and site ID (to identify your store)</li>
            <li>Owner email address (for account communications)</li>
            <li>Wix OAuth tokens (to read your orders and publish reviews)</li>
            <li>Subscription / billing information processed by Wix</li>
          </ul>

          <p className="mt-4 mb-2 font-medium text-slate-300">From your customers (review submitters):</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Name and email address (from the order, or entered during review)</li>
            <li>Star rating (1–5)</li>
            <li>Review text</li>
            <li>Photos uploaded with the review (stored on Cloudflare R2)</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Data">
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Send automated post-purchase review request emails to your customers</li>
            <li>Store and display approved reviews on your Wix product pages</li>
            <li>Provide you (the merchant) with a moderation dashboard</li>
            <li>Detect spam and policy-violating content using automated checks</li>
            <li>Process and manage your subscription via Wix Billing</li>
          </ul>
        </Section>

        <Section title="4. Data Sharing">
          <p className="mb-2">We do not sell your data. We share data only with:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li><strong className="text-slate-300">Wix</strong> — app platform, order data, billing</li>
            <li><strong className="text-slate-300">Neon</strong> — PostgreSQL database hosting (EU region)</li>
            <li><strong className="text-slate-300">Cloudflare R2</strong> — photo storage</li>
            <li><strong className="text-slate-300">Resend</strong> — transactional email delivery</li>
            <li><strong className="text-slate-300">Vercel</strong> — application hosting</li>
          </ul>
          <p className="mt-3 text-slate-400">All providers are bound by data processing agreements. No data is shared with third parties for advertising purposes.</p>
        </Section>

        <Section title="5. Data Retention">
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Reviews and media: retained while your app is installed, deleted within 30 days of uninstall</li>
            <li>Review request logs: retained for 90 days</li>
            <li>Merchant account data: deleted within 30 days of account deletion</li>
          </ul>
        </Section>

        <Section title="6. Your Rights">
          <p className="mb-2">You (merchants and customers) may:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Request a copy of your data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p className="mt-2 text-slate-400">
            Email <a href={`mailto:${contactEmail}`} className="text-sky-400 hover:underline">{contactEmail}</a> to exercise these rights. We respond within 14 days.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            OAuth tokens are encrypted at rest using AES-256-GCM. All data is transmitted over HTTPS.
            Access to production systems is restricted and audited.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            The app uses only session-essential cookies required to maintain your login state within the Wix iframe.
            No tracking or advertising cookies are used.
          </p>
        </Section>

        <Section title="9. Children">
          <p>
            This service is not directed at children under 13. We do not knowingly collect data from children.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We will notify merchants by email at least 7 days before any material change. Continued use of the app
            after the effective date constitutes acceptance of the updated policy.
          </p>
        </Section>

        <div className="border-t border-slate-800 pt-6 text-slate-500 text-xs">
          <p>
            Questions? Contact {" "}
            <a href={`mailto:${contactEmail}`} className="text-sky-400 hover:underline">{contactEmail}</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="text-slate-400 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
