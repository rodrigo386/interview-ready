import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.supabase.co https://www.gravatar.com https://secure.gravatar.com",
      // Supabase auth + REST + storage. Asaas iframes/redirects (sandbox + prod).
      // r.jina.ai for JD URL fetcher. Google Generative AI for client streaming
      // (we don't use it from client today, kept for future).
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.asaas.com https://sandbox.asaas.com https://r.jina.ai https://generativelanguage.googleapis.com",
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
