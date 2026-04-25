"use client";

import { useState } from "react";

const COLLAPSED_LINES = 6;

export function JobCard({
  jobTitle,
  jobDescription,
}: {
  jobTitle: string;
  jobDescription: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = jobDescription?.split(/\r?\n/) ?? [];
  const isTruncatable = lines.length > COLLAPSED_LINES;
  const visibleLines = expanded || !isTruncatable ? lines : lines.slice(0, COLLAPSED_LINES);

  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-prep">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
          Vaga
        </p>
        <h3 className="mt-0.5 text-lg font-bold text-ink">{jobTitle}</h3>
      </header>

      {jobDescription ? (
        <>
          <pre className="whitespace-pre-wrap font-sans text-[14px] leading-6 text-ink-2">
            {visibleLines.join("\n")}
            {isTruncatable && !expanded && "…"}
          </pre>
          {isTruncatable && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="self-start text-[13px] font-semibold text-orange-700 hover:text-orange-500"
              aria-expanded={expanded}
            >
              {expanded ? "Ver menos ▴" : "Ver descrição completa ▾"}
            </button>
          )}
        </>
      ) : (
        <p className="text-[14px] italic text-ink-3">
          Descrição da vaga não disponível.
        </p>
      )}
    </article>
  );
}
