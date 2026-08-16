import type { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { AnonAtsForm } from "@/components/anon-ats/AnonAtsForm";

export const metadata: Metadata = {
  title: "Análise ATS grátis do currículo — sem cadastro",
  description:
    "Cole a vaga, envie seu currículo e veja na hora o score ATS e o ajuste que mais te barra. Sem cadastro, sem cartão.",
  alternates: { canonical: "/analise-ats-gratis" },
};

export default function AnaliseAtsGratisPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Análise ATS grátis — PrepaVaga",
            applicationCategory: "BusinessApplication",
            inLanguage: "pt-BR",
            offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
          }),
        }}
      />
      <LandingNavbar />
      <main className="bg-bg">
        <div className="mx-auto max-w-2xl px-6 py-14">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
            Seu currículo passa no filtro ATS dessa vaga?
          </h1>
          <p className="mt-4 text-base leading-[1.55] text-ink-2 md:text-lg">
            A maioria dos currículos é cortada por software antes de qualquer
            pessoa ler. Descubra seu score em menos de um minuto — sem criar conta.
          </p>
          <div className="mt-10">
            <AnonAtsForm />
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
