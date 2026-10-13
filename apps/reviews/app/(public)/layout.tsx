import type { Metadata } from "next";

import "../styles/public.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
