import type { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ExemploView } from "@/components/exemplo/ExemploView";
import { EXEMPLO_PRINCIPAL } from "@/lib/exemplos/data";

export const metadata: Metadata = {
  title: "Veja um exemplo de preparação pronta",
  description:
    "Um exemplo ilustrativo do que a PrepaVaga entrega: análise ATS com score, pesquisa da empresa, faixa salarial e perguntas prováveis com roteiro de resposta. Veja o que você recebe antes de começar.",
  alternates: { canonical: "/exemplo" },
};

/**
 * Public, static "see it before you sign up" page. Company/candidate are
 * fictitious (labeled as such) — never expose a real user's prep here. Os
 * exemplos por área vivem em /exemplo/[slug]; o conteúdo está em
 * lib/exemplos/data.ts.
 */
export default function ExemploPage() {
  return (
    <>
      <LandingNavbar />
      <main className="bg-bg">
        <ExemploView exemplo={EXEMPLO_PRINCIPAL} />
      </main>
      <LandingFooter />
    </>
  );
}
