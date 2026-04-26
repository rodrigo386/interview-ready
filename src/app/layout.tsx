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

export const metadata: Metadata = {
  title: "PrepaVaga — Seu coach de carreira com IA",
  description:
    "Dossiê completo para sua próxima entrevista em 20 minutos. Pesquisa da empresa, CV reescrito e roteiros personalizados. Por R$ 49.",
  openGraph: {
    title: "PrepaVaga — Seu coach de carreira com IA",
    description:
      "Dossiê completo para sua próxima entrevista em 20 minutos. Pesquisa da empresa, CV reescrito e roteiros personalizados. Por R$ 49.",
    images: ["/brand/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${instrumentSerif.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
