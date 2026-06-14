import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "NeoReviewKit",
  description: "Collect, moderate, and display customer reviews on your Wix store.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-slate-950">
      <head>
        {/* Tailwind v4 Play CDN — generates utility styles at runtime from class names */}
        <script src="https://cdn.tailwindcss.com" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                theme: {
                  extend: {
                    colors: {
                      slate: {
                        950: '#020617',
                      },
                    },
                  },
                },
              }
            `,
          }}
        />
      </head>
      <body className="bg-slate-950 text-slate-200 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
