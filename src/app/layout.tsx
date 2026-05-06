import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

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

const DESCRIPTION =
  "Preparação completa para entrevista com IA: análise ATS, pesquisa da empresa em tempo real, perguntas prováveis e CV reescrito. Primeira prep grátis.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Preparação para entrevista com IA — PrepaVaga",
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
    title: "Preparação para entrevista com IA — PrepaVaga",
    description: DESCRIPTION,
    type: "website",
    locale: "pt_BR",
    siteName: "PrepaVaga",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Preparação para entrevista com IA — PrepaVaga",
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
      </body>
    </html>
  );
}
