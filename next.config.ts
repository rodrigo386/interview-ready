import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // pdf-parse v2 bundles its PDF.js worker as a sibling pdf.worker.mjs file.
  // Next's tracer doesn't copy it into .next/server, so we mark it external
  // and let runtime Node resolve it from node_modules.
  serverExternalPackages: ["pdf-parse"],
  // Copy the worker into the standalone output so Railway can find it.
  outputFileTracingIncludes: {
    "/prep/new": [
      "./node_modules/.pnpm/pdf-parse@*/node_modules/pdf-parse/dist/**",
      "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/build/**",
    ],
  },
};

export default nextConfig;
