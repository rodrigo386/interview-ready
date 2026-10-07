import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ExemploView } from "@/components/exemplo/ExemploView";
import { EXEMPLOS, getExemplo } from "@/lib/exemplos/data";

export function generateStaticParams() {
  return EXEMPLOS.map((e) => ({ slug: e.slug }));
}

// Slug fora da lista é 404, não renderização sob demanda.
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const e = getExemplo(slug);
  if (!e) return {};
  return {
    title: `Exemplo de preparação para ${e.cargo}`,
    description: `Um exemplo ilustrativo de preparação para ${e.cargo}: score ATS com os ajustes que mais pesam, pesquisa da empresa, faixa salarial e perguntas com roteiro. Veja o que você recebe antes de começar.`,
    alternates: { canonical: `/exemplo/${e.slug}` },
  };
}

export default async function ExemploPorAreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = getExemplo(slug);
  if (!e) notFound();
  return (
    <>
      <LandingNavbar />
      <main className="bg-bg">
        <ExemploView exemplo={e} />
      </main>
      <LandingFooter />
    </>
  );
}
