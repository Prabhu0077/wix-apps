// Widget layout — no sidebar, no nav. This page is embedded in a Wix iframe.
// Overrides the root layout's AppShell for the /widget route.
import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Customer Reviews",
  robots: "noindex",
};

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script src="https://cdn.tailwindcss.com" async />
      </head>
      <body style={{ margin: 0, padding: "0 16px", background: "transparent", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
