import type { AtsAnalysis, CvRewrite } from "@/lib/ai/schemas";
import { runAtsAnalysis } from "@/app/prep/[id]/ats-actions";
import { PendingButton } from "./PendingButton";
import { CvRewriteCta } from "./CvRewriteCta";
import { CvRewriteSkeleton } from "./CvRewriteSkeleton";
import { CvRewriteFailed } from "./CvRewriteFailed";
import { CvRewriteView } from "./CvRewriteView";

function ringColor(score: number): string {
  if (score < 40) return "text-red-500";
  if (score < 70) return "text-amber-500";
  return "text-emerald-500";
}

export function AtsScoreCard({
  analysis,
  sessionId,
  cvRewrite,
  cvRewriteStatus,
  cvRewriteError,
}: {
  analysis: AtsAnalysis;
  sessionId: string;
  cvRewrite?: CvRewrite | null;
  cvRewriteStatus?: string | null;
  cvRewriteError?: string | null;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (analysis.score / 100) * c;
  const rerunAction = runAtsAnalysis.bind(null, sessionId);
  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center gap-4">
          <svg width="96" height="96" viewBox="0 0 80 80" className={ringColor(analysis.score)}>
            <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" />
            <circle
              cx="40" cy="40" r={r} fill="none"
              stroke="currentColor" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              transform="rotate(-90 40 40)"
            />
            <text x="40" y="46" textAnchor="middle" fontSize="22" fontWeight="bold" fill="currentColor">
              {analysis.score}
            </text>
          </svg>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">ATS Match Score</p>
            <p className="text-xl font-semibold">{analysis.score} / 100</p>
            <p className="text-xs text-zinc-500">
              Title match: {analysis.title_match.match_score}%
            </p>
          </div>
        </div>
        <p className="text-sm text-zinc-300 md:flex-1">{analysis.overall_assessment}</p>
        <form action={rerunAction} className="shrink-0">
          <PendingButton idleLabel="↻ Re-run" pendingLabel="Re-running…" variant="secondary" />
        </form>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Top fixes</h3>
        <ol className="mt-4 space-y-3">
          {analysis.top_fixes.map((fix) => (
            <li key={fix.priority} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-zinc-100">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs text-white">
                    {fix.priority}
                  </span>
                  {fix.gap}
                </p>
              </div>
              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Your CV</dt>
                  <dd className="mt-1 text-zinc-300">{fix.original_cv_language || <em className="text-zinc-500">(absent)</em>}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">JD language</dt>
                  <dd className="mt-1 text-zinc-300">{fix.jd_language}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Suggested rewrite</dt>
                <dd className="mt-1 rounded bg-zinc-950 p-3 text-sm text-emerald-200">{fix.suggested_rewrite}</dd>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {cvRewriteStatus === "generating" ? (
        <CvRewriteSkeleton />
      ) : cvRewriteStatus === "failed" ? (
        <CvRewriteFailed sessionId={sessionId} errorMessage={cvRewriteError ?? null} />
      ) : cvRewriteStatus === "complete" && cvRewrite ? (
        <CvRewriteView rewrite={cvRewrite} sessionId={sessionId} />
      ) : (
        <CvRewriteCta sessionId={sessionId} />
      )}

      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Keyword analysis ({analysis.keyword_analysis.critical.length + analysis.keyword_analysis.high.length + analysis.keyword_analysis.medium.length} keywords)
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <KeywordColumn label="Critical" keywords={analysis.keyword_analysis.critical} />
          <KeywordColumn label="High" keywords={analysis.keyword_analysis.high} />
          <KeywordColumn label="Medium" keywords={analysis.keyword_analysis.medium} />
        </div>
      </details>
    </section>
  );
}

function KeywordColumn({ label, keywords }: { label: string; keywords: AtsAnalysis["keyword_analysis"]["critical"] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <ul className="mt-2 space-y-1 text-xs">
        {keywords.map((kw) => (
          <li key={kw.keyword} className={kw.found ? "text-emerald-300" : "text-red-300"} title={kw.context ?? ""}>
            {kw.found ? "✓" : "✗"} {kw.keyword}
          </li>
        ))}
      </ul>
    </div>
  );
}
