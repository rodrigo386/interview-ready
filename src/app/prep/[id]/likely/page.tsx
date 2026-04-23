import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { classifyPrepSections } from "@/lib/prep/section-classifier";
import { QuestionPager } from "@/components/prep/QuestionPager";
import type { PrepCard } from "@/lib/ai/schemas";

export default async function LikelyPage({
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

  const { likely } = classifyPrepSections(parsed.data.sections);
  if (!likely || likely.cards.length === 0) {
    return (
      <EmptyState
        sessionId={id}
        title="Sem perguntas básicas geradas"
        body="O prep ainda não tem essa seção. Volte à visão geral."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
            Passo 3 · Perguntas básicas
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            Treino dirigido
          </h2>
        </div>
        <ConfidenceBadge level={likely.cards[0].confidence_level} />
      </header>

      <QuestionPager
        accent="orange"
        cards={likely.cards}
        sessionId={id}
        step={3}
        nextHref={`/prep/${id}/deep-dive`}
        nextStepCtaLabel="Ir pro aprofundamento →"
        defaultMeta="⏱ Leva ~90s pra responder em voz alta"
        buildSections={(card: PrepCard) => [
          {
            heading: "💡 O que o avaliador quer ouvir",
            body: (
              <ul className="list-disc pl-5 space-y-1">
                {card.key_points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            ),
          },
          {
            heading: "📝 Resposta modelo (edite como quiser)",
            body: (
              <p className="rounded-md bg-orange-soft/40 p-4 italic text-ink">
                {card.sample_answer}
              </p>
            ),
          },
          ...(card.tips
            ? [{ heading: "🎯 Dica", body: <p>{card.tips}</p> }]
            : []),
        ]}
      />
    </div>
  );
}

function ConfidenceBadge({ level }: { level: "low" | "medium" | "high" }) {
  const map = {
    high: { label: "✓ Alta confiança", cls: "bg-green-soft text-green-700" },
    medium: {
      label: "⚠ Média confiança",
      cls: "bg-yellow-soft text-yellow-700",
    },
    low: { label: "⚠ Baixa confiança", cls: "bg-red-soft text-red-500" },
  } as const;
  const m = map[level];
  return (
    <span className={`rounded-pill px-3 py-1 text-xs font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

function EmptyState({
  sessionId,
  title,
  body,
}: {
  sessionId: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-8 text-center shadow-prep">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-2">{body}</p>
      <Link
        href={`/prep/${sessionId}`}
        className="mt-4 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white"
      >
        ← Voltar à visão geral
      </Link>
    </div>
  );
}
