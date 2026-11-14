import type { NextConfig } from "next";

/**
 * The dashboard renders inside a Wix iframe at manage.wix.com: only Wix may
 * frame it. The storefront pages under /widget are framed by our custom
 * element on the merchant's own site (any domain), so they allow any https
 * parent; they show only published reviews.
 */
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/((?!widget).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://*.wix.com https://manage.wix.com",
          },
        ],
      },
      {
        source: "/widget/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors https: http://localhost:*" }],
      },
      {
        source: "/widget",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors https: http://localhost:*" }],
      },
      {
        // The custom element script is loaded by any site.
        source: "/elements/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=3600" },
        ],
      },
    ];
  },
};

export default config;
