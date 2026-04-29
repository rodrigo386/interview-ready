import { notFound } from "next/navigation";
import { atsAnalysisSchema, prepGuideSchema, cvRewriteSchema } from "@/lib/ai/schemas";
import { loadPrepSession } from "@/lib/prep/load-session";
import { AtsHero } from "@/components/prep/AtsHero";
import { IssueRow } from "@/components/prep/IssueRow";
import { AtsCtaCard } from "@/components/prep/AtsCtaCard";
import { AtsSkeleton } from "@/components/prep/AtsSkeleton";
import { AtsFailed } from "@/components/prep/AtsFailed";
import { CvRewriteSkeleton } from "@/components/prep/CvRewriteSkeleton";
import { CvRewriteFailed } from "@/components/prep/CvRewriteFailed";
import { CvRewriteView } from "@/components/prep/CvRewriteView";
import { CvRewriteCta } from "@/components/prep/CvRewriteCta";
import { runAtsAnalysis } from "@/app/prep/[id]/ats-actions";
import { PendingButton } from "@/components/prep/PendingButton";

export default async function AtsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await loadPrepSession(id);
  if (!session) notFound();

  const guideParsed = prepGuideSchema.safeParse(session.prep_guide);
  const role = guideParsed.success ? guideParsed.data.meta.role : "esta vaga";

  if (session.ats_status === "generating") return <AtsSkeleton />;
  if (session.ats_status === "failed") {
    return <AtsFailed sessionId={session.id} errorMessage={session.ats_error_message} />;
  }
  if (session.ats_status !== "complete") {
    return <AtsCtaCard sessionId={session.id} />;
  }

  const parsed = atsAnalysisSchema.safeParse(session.ats_analysis);
  if (!parsed.success) {
    return <AtsFailed sessionId={session.id} errorMessage="Stored analysis is malformed." />;
  }
  const analysis = parsed.data;
  const rerun = runAtsAnalysis.bind(null, session.id);

  const top3 = analysis.top_fixes.slice(0, 3);
  const totalImpact = top3.length * 12;
  const projected = Math.min(100, analysis.score + totalImpact);

  const rewriteParsed =
    session.cv_rewrite_status === "complete"
      ? cvRewriteSchema.safeParse(session.cv_rewrite)
      : null;
  const validRewrite = rewriteParsed?.success ? rewriteParsed.data : null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
            Passo 2 · Compatibilidade ATS
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            Seu CV vs. {role}
          </h2>
        </div>
        <form action={rerun}>
          <PendingButton idleLabel="↻ Rerodar análise" pendingLabel="Rerodando…" variant="secondary" />
        </form>
      </header>

      <AtsHero analysis={analysis} role={role} />

      {analysis.score < 71 && top3.length > 0 && (
        <div
          className="rounded-lg border-l-4 border-green-500 bg-green-soft px-5 py-4 text-[15px] text-ink"
        >
          <p>
            <span className="mr-1">→</span>
            Aplicando os {top3.length} ajustes abaixo, seu score sobe pra <strong>~{projected}</strong>.
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            Estimativa baseada nos ajustes prioritários · pode levar 8 minutos
          </p>
        </div>
      )}

      <section className="rounded-lg border border-line bg-white p-5 shadow-prep">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">
            {top3.length} ajustes em ordem de impacto
          </h3>
        </header>
        <ul className="space-y-2">
          {top3.map((fix, i) => (
            <IssueRow
              key={fix.priority}
              severity={i === 0 ? "critical" : "warning"}
              number={fix.priority}
              title={fix.gap}
              description={fix.jd_language}
              impact={`+${10 + (top3.length - i) * 4} pts`}
            />
          ))}
        </ul>
      </section>

      <section>
        {session.cv_rewrite_status === "generating" ? (
          <CvRewriteSkeleton />
        ) : session.cv_rewrite_status === "failed" ? (
          <CvRewriteFailed sessionId={session.id} errorMessage={session.cv_rewrite_error ?? null} />
        ) : session.cv_rewrite_status === "complete" && validRewrite ? (
          <CvRewriteView rewrite={validRewrite} sessionId={session.id} />
        ) : (
          <CvRewriteCta sessionId={session.id} />
        )}
      </section>
    </div>
  );
}
