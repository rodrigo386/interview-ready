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
};

export default nextConfig;
