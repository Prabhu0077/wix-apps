"use client";

// AppShell — persistent navigation sidebar that preserves the Wix instanceId
// across all route changes inside the merchant dashboard.
//
// Wix passes ?instanceId=... when loading the app in an iframe.
// Without this, navigating via Link strips the param and the API returns 404.

import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const NAV_ITEMS = [
  { href: "/",         label: "Overview",    icon: "◈" },
  { href: "/reviews",  label: "Moderation",  icon: "✦" },
  { href: "/settings", label: "Settings",    icon: "⚙" },
  { href: "/billing",  label: "Billing",     icon: "◎" },
] as const;

function NavSidebar({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const instanceId = searchParams.get("instanceId");

  function href(path: string) {
    return instanceId ? `${path}?instanceId=${encodeURIComponent(instanceId)}` : path;
  }

  function isActive(path: string) {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <nav className="w-48 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col py-4">
        {/* Brand */}
        <div className="px-4 mb-6">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">NeoReviewKit</p>
          <p className="text-xs text-slate-500 mt-0.5">by NeoNerd</p>
        </div>

        {/* Nav links */}
        <ul className="flex-1 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ href: path, label, icon }) => (
            <li key={path}>
              <Link
                href={href(path)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive(path)
                    ? "bg-slate-700 text-white font-medium"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Footer links */}
        <div className="px-4 pt-4 border-t border-slate-800 space-y-1">
          <a
            href="/privacy"
            target="_blank"
            className="block text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="/support"
            target="_blank"
            className="block text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Support
          </a>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-950">{children}</main>
    </div>
  );
}

// Wrap in Suspense — useSearchParams requires it with Next.js App Router
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen">
          <div className="w-48 bg-slate-900 border-r border-slate-800" />
          <main className="flex-1 bg-slate-950">{children}</main>
        </div>
      }
    >
      <NavSidebar>{children}</NavSidebar>
    </Suspense>
  );
}
