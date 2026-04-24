import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { classifyPrepSections } from "@/lib/prep/section-classifier";
import { QuestionPager, type PagerPage } from "@/components/prep/QuestionPager";
import { SuccessBanner } from "@/components/prep/SuccessBanner";

export default async function AskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("prep_sessions")
    .select("prep_guide")
    .eq("id", id)
    .single();
  if (!session) notFound();
  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) notFound();

  const { ask } = classifyPrepSections(parsed.data.sections);
  if (!ask || ask.cards.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center shadow-prep">
        <h2 className="text-xl font-bold text-ink">Sem perguntas pra fazer geradas</h2>
        <Link
          href={`/prep/${id}`}
          className="mt-4 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SuccessBanner />
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-green-700">
          Passo 5 · Suas perguntas pro entrevistador
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          Última etapa
        </h2>
      </header>

      <QuestionPager
        accent="green"
        pages={ask.cards.map(
          (card): PagerPage => ({
            title: card.question,
            chips: card.references_cv,
            sections: [
              {
                heading: "🎯 Por que fazer essa pergunta",
                body: <p>{card.tips || card.sample_answer}</p>,
              },
              {
                heading: "🎧 O que escutar",
                body: (
                  <ul className="list-disc pl-5 space-y-1 italic">
                    {card.key_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                ),
              },
            ],
          }),
        )}
        sessionId={id}
        step={5}
        nextHref={`/prep/${id}`}
        nextStepCtaLabel="Finalizar prep →"
        defaultMeta="📋 2 opções alternativas caso essa seja respondida antes"
      />
    </div>
  );
}
