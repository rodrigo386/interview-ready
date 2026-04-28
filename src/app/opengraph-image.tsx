import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt =
  "PrepaVAGA — Coach de carreira com IA. Entre pronto. Saia contratado.";

export default async function OpengraphImage() {
  const [interRegular, interBold] = await Promise.all([
    fetchFontSafe("https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuLyfMZg.ttf"),
    fetchFontSafe("https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuI6fMZg.ttf"),
  ]);
  const fonts =
    interRegular && interBold
      ? [
          { name: "Inter", data: interRegular, style: "normal" as const, weight: 400 as const },
          { name: "Inter", data: interBold, style: "normal" as const, weight: 700 as const },
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
            opacity: 0.18,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.45) 1px, transparent 0)",
            backgroundSize: "32px 32px",
            display: "flex",
          }}
        />

        {/* Floating mini CVs (decorative) */}
        <MiniCv style={{ top: 90, right: 110, transform: "rotate(8deg)", width: 110 }} accent="#D4D4D4" />
        <MiniCv
          style={{ top: 240, right: 70, transform: "rotate(-6deg)", width: 130 }}
          accent="#EA580C"
        />
        <MiniCv style={{ top: 410, right: 180, transform: "rotate(4deg)", width: 95 }} accent="#D4D4D4" />

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

        {/* Headline + sub */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            maxWidth: 760,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              color: "#1A1A1A",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div>Entre pronto.</div>
            <div>Saia contratado.</div>
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              lineHeight: 1.45,
              color: "#4A4A4A",
              maxWidth: 720,
            }}
          >
            Coach de carreira com IA. Em minutos, o dossiê completo da sua próxima vaga: empresa
            pesquisada, CV reescrito pra ATS e roteiros prontos.
          </div>
        </div>

        {/* Bottom row: pill + URL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 36,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#EA580C",
              color: "#FFFFFF",
              padding: "16px 28px",
              borderRadius: 999,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            <span>Comece grátis</span>
            <span>→</span>
          </div>
          <div style={{ fontSize: 22, color: "#8A8A8A", fontWeight: 500 }}>
            prepavaga.com.br
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts ? { fonts } : {}),
    },
  );
}

function MiniCv({
  style,
  accent,
}: {
  style: React.CSSProperties;
  accent: string;
}) {
  const width = (style.width as number) ?? 120;
  const height = Math.round(width * 1.35);
  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        background: "#FFFFFF",
        border: "1px solid #E5E5E5",
        borderRadius: 12,
        boxShadow: "0 12px 30px -8px rgba(0,0,0,0.18)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: accent,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
          <div style={{ height: 4, background: "#D4D4D4", borderRadius: 2 }} />
          <div style={{ height: 3, background: "#E5E5E5", borderRadius: 2, width: "70%" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        <div style={{ height: 3, background: "#E5E5E5", borderRadius: 2 }} />
        <div style={{ height: 3, background: "#E5E5E5", borderRadius: 2, width: "85%" }} />
        <div style={{ height: 3, background: "#E5E5E5", borderRadius: 2, width: "65%" }} />
        <div style={{ height: 3, background: "#E5E5E5", borderRadius: 2 }} />
        <div style={{ height: 3, background: "#E5E5E5", borderRadius: 2, width: "55%" }} />
      </div>
    </div>
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
