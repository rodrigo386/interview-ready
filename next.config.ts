import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Force-inline analytics env vars into the client bundle. The automatic
  // NEXT_PUBLIC_* substitution wasn't reaching the AnalyticsClient module
  // (compiled chunks contain a runtime `process.env.NEXT_PUBLIC_POSTHOG_KEY`
  // lookup instead of the value), so initAnalytics never saw the key.
  // Explicit `env` config is the reliable substitution path.
  // KEY has no safe default — empty string is correct when unset, and
  // isAnalyticsEnabled() treats "" as disabled. HOST DOES have a safe default:
  // if it's left empty, posthog-js resolves /e/, /flags/, /array/... against
  // the app's own origin and 404s. Inline the real EU host so a missing
  // Railway env var can never silently break analytics again.
  env: {
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
    NEXT_PUBLIC_POSTHOG_HOST:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
  },
  // pdf-parse v2 bundles its PDF.js worker as a sibling pdf.worker.mjs file.
  // Next's tracer doesn't copy it into .next/server, so we mark it external
  // and let runtime Node resolve it from node_modules.
  serverExternalPackages: ["pdf-parse"],
  // Copy the worker into the standalone output so Railway can find it.
  // pdfjs-dist's legacy build dynamically requires @napi-rs/canvas to polyfill
  // DOMMatrix/ImageData/Path2D. Without these globals, parsing PDFs that touch
  // any vector/transform path throws ReferenceError: DOMMatrix is not defined.
  outputFileTracingIncludes: {
    "/prep/new": [
      "./node_modules/.pnpm/pdf-parse@*/node_modules/pdf-parse/dist/**",
      "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/build/**",
      "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/.pnpm/@napi-rs+canvas@*/node_modules/@napi-rs/canvas/**",
      "./node_modules/.pnpm/@napi-rs+canvas-*/node_modules/@napi-rs/canvas-*/**",
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.prepavaga.com.br" }],
        destination: "https://prepavaga.com.br/:path*",
        permanent: true,
      },
      // /blog was never a route here, but GSC reported a 404 — some external
      // link or cached redirect pointed there. Permanent redirect to /artigos
      // captures any residual traffic and clears the 404.
      {
        source: "/blog",
        destination: "/artigos",
        permanent: true,
      },
      {
        source: "/blog/:path*",
        destination: "/artigos/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Baseline security headers. CSP is intentionally permissive for now
    // (allows Supabase + Asaas + Google Fonts + Jina Reader + inline next-auth
    // chunks). Tighten by adding nonces on a separate pass once we have
    // Sentry / Plausible wired so we know all script origins.
    const csp = [
      "default-src 'self'",
      // 'unsafe-inline' for Next 15 inline RSC payload + Tailwind runtime;
      // 'unsafe-eval' for the dev hot reload (no-op in prod build).
      // *.posthog.com / *.i.posthog.com: posthog-js lazy-loads remote scripts
      // (array/<token>/config.js, static/surveys.js) from eu-assets.i.posthog.com.
      // Without these the SDK boots but the remote config + surveys extension
      // are CSP-blocked. connect-src already allows the same hosts for /e/ /flags/.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://*.i.posthog.com",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.supabase.co https://www.gravatar.com https://secure.gravatar.com",
      // Supabase auth + REST + storage. Asaas iframes/redirects (sandbox + prod).
      // r.jina.ai for JD URL fetcher. Google Generative AI for client streaming
      // (we don't use it from client today, kept for future). viacep.com.br
      // for CEP lookup (auto-fill endereço no signup + AddressDialog).
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.asaas.com https://sandbox.asaas.com https://r.jina.ai https://generativelanguage.googleapis.com https://*.posthog.com https://*.i.posthog.com https://viacep.com.br",
      "frame-src 'self' https://*.asaas.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.asaas.com",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Disable APIs we never use. Keeps third-party iframes (Asaas
            // checkout) from silently asking for cam/mic/geo.
            value:
              "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
