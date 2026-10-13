"use client";

// Frame for every dashboard page: product header, page tabs, maker credit.
// Wix shows the app in its own business-manager sidebar, so in-app
// navigation is a tab row, not a second sidebar (Wix UX guidelines).
// Every link keeps the signed `instance` param the dashboard APIs require.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ProductIcon } from "@/components/ui/ProductIcon";
import { MAKER_NAME, MAKER_URL, PRODUCT_NAME } from "@/lib/product";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/reviews", label: "Reviews" },
  { href: "/settings", label: "Settings" },
  { href: "/billing", label: "Plan" },
] as const;

function Header() {
  const pathname = usePathname();
  const instance = useSearchParams().get("instance");
  const withInstance = (p: string) =>
    instance ? `${p}?instance=${encodeURIComponent(instance)}` : p;
  const current = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  return (
    <header className="topbar">
      <div className="topbar-row">
        <ProductIcon size={32} />
        <h1 className="topbar-title">{PRODUCT_NAME}</h1>
      </div>
      <nav className="tabs" aria-label={`${PRODUCT_NAME} pages`}>
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={withInstance(t.href)}
            className="tab"
            aria-current={current(t.href) ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function DashboardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="frame">
      <Suspense
        fallback={
          <header className="topbar">
            <div className="topbar-row">
              <ProductIcon size={32} />
              <h1 className="topbar-title">{PRODUCT_NAME}</h1>
            </div>
          </header>
        }
      >
        <Header />
      </Suspense>
      <div className="content">{children}</div>
      <footer className="maker">
        {PRODUCT_NAME} is made by{" "}
        <a href={MAKER_URL} target="_blank" rel="noopener">
          {MAKER_NAME}
        </a>
        . Need help? Visit{" "}
        <a href="/support" target="_blank" rel="noopener">
          support
        </a>{" "}
        or read our{" "}
        <a href="/privacy" target="_blank" rel="noopener">
          privacy policy
        </a>{" "}
        and{" "}
        <a href="/terms" target="_blank" rel="noopener">
          terms
        </a>
        .
      </footer>
    </div>
  );
}
