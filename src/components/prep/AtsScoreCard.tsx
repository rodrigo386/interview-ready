"use client";

import { useState } from "react";
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
    <section className="mb-8 rounded-lg border border-border bg-bg p-6">
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
            <p className="text-xs uppercase tracking-wide text-text-tertiary">
              Compatibilidade ATS
            </p>
            <p className="text-xl font-semibold text-text-primary">
              {analysis.score} / 100
            </p>
            <p className="text-xs text-text-tertiary">
              Match de título: {analysis.title_match.match_score}%
            </p>
          </div>
        </div>
        <p className="text-sm text-text-secondary md:flex-1">{analysis.overall_assessment}</p>
        <form action={rerunAction} className="shrink-0">
          <PendingButton idleLabel="↻ Rerodar" pendingLabel="Rerodando…" variant="secondary" />
        </form>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">
          Principais ajustes
        </h3>
        <ol className="mt-4 space-y-3">
          {analysis.top_fixes.map((fix) => (
            <FixItem key={fix.priority} fix={fix} />
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
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-text-tertiary">
          Análise de keywords (
          {analysis.keyword_analysis.critical.length +
            analysis.keyword_analysis.high.length +
            analysis.keyword_analysis.medium.length}
          )
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <KeywordColumn label="Crítica" keywords={analysis.keyword_analysis.critical} />
          <KeywordColumn label="Alta" keywords={analysis.keyword_analysis.high} />
          <KeywordColumn label="Média" keywords={analysis.keyword_analysis.medium} />
        </div>
      </details>
    </section>
  );
}

function FixItem({ fix }: { fix: AtsAnalysis["top_fixes"][number] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fix.suggested_rewrite);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-text-primary">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {fix.priority}
          </span>
          {fix.gap}
        </p>
      </div>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-text-tertiary">Seu CV</dt>
          <dd className="mt-1 italic text-text-secondary">
            {fix.original_cv_language || <em className="text-text-muted">(ausente)</em>}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-text-tertiary">
            Linguagem da vaga
          </dt>
          <dd className="mt-1 text-text-primary">{fix.jd_language}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <dt className="text-xs uppercase tracking-wide text-text-tertiary">
            Sugestão reescrita
          </dt>
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-border bg-bg px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-surface-muted"
          >
            {copied ? "✓ Copiado" : "📋 Copiar sugestão"}
          </button>
        </div>
        <dd className="mt-2 rounded bg-brand-50 p-3 text-sm text-text-primary dark:bg-brand-900/20">
          ✓ {fix.suggested_rewrite}
        </dd>
      </div>
    </li>
  );
}

function KeywordColumn({ label, keywords }: { label: string; keywords: AtsAnalysis["keyword_analysis"]["critical"] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {keywords.map((kw) => (
          <li
            key={kw.keyword}
            className={kw.found ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}
            title={kw.context ?? ""}
          >
            {kw.found ? "✓" : "✗"} {kw.keyword}
          </li>
        ))}
      </ul>
    </div>
  );
}
