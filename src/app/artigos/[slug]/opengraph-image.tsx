import { ImageResponse } from "next/og";
import { getPostBySlug, listSlugs } from "@/lib/blog/posts";

export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "PrepaVaga — artigo";

export async function generateStaticParams() {
  const slugs = await listSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function ArticleOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const title = post?.title ?? "Artigo · PrepaVAGA";
  const tag = post?.tags?.[0] ?? "PrepaVAGA";
  const readingMinutes = post?.readingMinutes ?? null;

  const [interRegular, interBold] = await Promise.all([
    fetchFontSafe(
      "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuLyfMZg.ttf",
    ),
    fetchFontSafe(
      "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuI6fMZg.ttf",
    ),
  ]);
  const fonts =
    interRegular && interBold
      ? [
          {
            name: "Inter",
            data: interRegular,
            style: "normal" as const,
            weight: 400 as const,
          },
          {
            name: "Inter",
            data: interBold,
            style: "normal" as const,
            weight: 700 as const,
          },
        ]
      : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          fontFamily: "Inter",
          color: "#1A1A1A",
          position: "relative",
          padding: "64px 80px",
        }}
      >
        {/* Dot pattern background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.14,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.45) 1px, transparent 0)",
            backgroundSize: "32px 32px",
            display: "flex",
          }}
        />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="38" height="38" viewBox="0 0 80 80">
            <path
              d="M 18 60 Q 18 24 40 24 Q 62 24 62 60"
              fill="none"
              stroke="#EA580C"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <circle cx="18" cy="60" r="5" fill="#1A1A1A" />
            <circle cx="62" cy="60" r="5" fill="#EA580C" />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            <span>Prepa</span>
            <span style={{ color: "#EA580C" }}>VAGA</span>
          </div>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            color: "#D94818",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {tag}
          {readingMinutes ? ` · ${readingMinutes} min` : ""}
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.025em",
            color: "#1A1A1A",
            maxWidth: 1040,
          }}
        >
          {title}
        </div>

        {/* Bottom row: URL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#EA580C",
              color: "#FFFFFF",
              padding: "14px 24px",
              borderRadius: 999,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            <span>Ler artigo</span>
            <span>→</span>
          </div>
          <div style={{ fontSize: 20, color: "#8A8A8A", fontWeight: 500 }}>
            prepavaga.com.br/artigos
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts ? { fonts } : {}),
      headers: {
        // Same noindex treatment as the root /opengraph-image — these URLs
        // are referenced via OG meta, not landing pages. Avoids GSC flagging
        // them as "Crawled - currently not indexed".
        "X-Robots-Tag": "noindex",
        "Cache-Control": "public, max-age=3600, immutable",
      },
    },
  );
}

async function fetchFontSafe(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}
