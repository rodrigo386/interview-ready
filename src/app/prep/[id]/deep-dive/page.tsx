import { notFound } from "next/navigation";
import Link from "next/link";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { classifyPrepSections } from "@/lib/prep/section-classifier";
import { QuestionPager, type PagerPage } from "@/components/prep/QuestionPager";
import { loadPrepSession } from "@/lib/prep/load-session";

export default async function DeepDivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await loadPrepSession(id);
  if (!session) notFound();
  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) notFound();

  const { deepDive } = classifyPrepSections(parsed.data.sections);
  if (!deepDive || deepDive.cards.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center shadow-prep">
        <h2 className="text-xl font-bold text-ink">Sem perguntas de aprofundamento</h2>
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
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-yellow-700">
            Passo 4 · Aprofundamento
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            Pergunta difícil
          </h2>
        </div>
        <span className="rounded-pill bg-yellow-soft px-3 py-1 text-xs font-semibold text-yellow-700">
          🔥 Pergunta difícil
        </span>
      </header>

      <QuestionPager
        accent="yellow"
        pages={deepDive.cards.map(
          (card): PagerPage => ({
            title: card.question,
            chips: card.references_cv,
            sections: [
              {
                heading: "🎯 Pontos-chave (evitar se perder)",
                body: (
                  <ul className="list-disc pl-5 space-y-1">
                    {card.key_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                ),
              },
              {
                heading: "📝 Resposta modelo",
                body: (
                  <p className="rounded-md bg-yellow-soft/40 p-4 italic text-ink">
                    {card.sample_answer}
                  </p>
                ),
              },
              ...(card.tips
                ? [{ heading: "💡 Dica", body: <p>{card.tips}</p> }]
                : []),
            ],
          }),
        )}
        sessionId={id}
        step={4}
        nextHref={`/prep/${id}/ask`}
        nextStepCtaLabel="Ir pras suas perguntas →"
        defaultMeta="⏱ Resposta ideal: 2-3 min"
      />
    </div>
  );
}
