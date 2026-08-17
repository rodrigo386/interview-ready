import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PageViewTracker } from "@/components/PageViewTracker";
import { AnalyticsClient } from "@/components/AnalyticsClient";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";

// Search Console (14/05–13/08): a home recebe 1.014 impressões na posição
// 5,5 com CTR de 0,39%, e a maior consulta isolada é "prepara cv" (840
// impressões) — intenção de currículo, não de entrevista. O título liderava
// com "preparação para entrevista" e não casava com essa busca.
const DESCRIPTION =
  "Cole a vaga e envie seu CV: análise ATS é grátis na hora. A preparação completa com currículo otimizado e as perguntas prováveis da entrevista custa R$10.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Análise ATS do currículo + preparação para entrevista — PrepaVaga",
    template: "%s · PrepaVaga",
  },
  description: DESCRIPTION,
  keywords: [
    "preparação para entrevista",
    "entrevista de emprego",
    "análise ATS",
    "currículo ATS",
    "perguntas de entrevista",
    "preparar entrevista",
    "preparar entrevista de emprego com IA",
    "como se preparar para entrevista com IA",
    "kit de entrevista",
    "PrepaVaga",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Análise ATS do currículo + preparação para entrevista — PrepaVaga",
    description: DESCRIPTION,
    type: "website",
    locale: "pt_BR",
    siteName: "PrepaVaga",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Análise ATS do currículo + preparação para entrevista — PrepaVaga",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PrepaVaga",
  alternateName: "Pro AI Circle",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description: DESCRIPTION,
  sameAs: [
    "https://www.linkedin.com/company/prepavaga/",
    "https://instagram.com/prepavaga",
  ],
  parentOrganization: {
    "@type": "Organization",
    name: "PROAICIRCLE CONSULTORIA EMPRESARIAL LTDA",
    taxID: "62.805.016/0001-29",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "prepavaga@prepavaga.com.br",
    availableLanguage: ["Portuguese"],
  },
};

const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PrepaVaga",
  url: SITE_URL,
  inLanguage: "pt-BR",
  publisher: { "@type": "Organization", name: "PrepaVaga", url: SITE_URL },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${instrumentSerif.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
        />
        <ThemeProvider>{children}</ThemeProvider>
        <PageViewTracker />
        <AnalyticsClient />
      </body>
    </html>
  );
}
