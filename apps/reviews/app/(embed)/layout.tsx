import type { Metadata } from "next";

import "../styles/widget.css";

export const metadata: Metadata = {
  title: "Customer reviews",
  robots: { index: false, follow: false },
};

// Storefront embed: no dashboard chrome, transparent so the product page shows through.
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: "0 16px", background: "transparent" }}>{children}</body>
    </html>
  );
}
