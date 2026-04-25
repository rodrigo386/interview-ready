"use client";

import { useMemo, useState } from "react";
import { JdBlocks, parseJd, summaryFromBlocks } from "./JdRenderer";

export function JobCard({
  jobTitle,
  jobDescription,
}: {
  jobTitle: string;
  jobDescription: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { blocks, summary } = useMemo(() => {
    if (!jobDescription) return { blocks: [], summary: null as string | null };
    const blocks = parseJd(jobDescription);
    return { blocks, summary: summaryFromBlocks(blocks) };
  }, [jobDescription]);

  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-prep">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
          Vaga
        </p>
        <h3 className="mt-0.5 text-lg font-bold text-ink">{jobTitle}</h3>
      </header>

      {!jobDescription && (
        <p className="text-[14px] italic text-ink-3">
          Descrição da vaga não disponível.
        </p>
      )}

      {jobDescription && !expanded && (
        <>
          {summary ? (
            <div className="rounded-lg border border-line bg-bg p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
                Resumo
              </p>
              <p className="mt-1.5 text-[14px] leading-6 text-ink-2">{summary}</p>
            </div>
          ) : (
            <p className="text-[14px] italic text-ink-3">
              Não conseguimos gerar resumo automático.
            </p>
          )}
          <div className="flex items-center gap-2 text-[11px] text-ink-3">
            <span>{blocks.length} {blocks.length === 1 ? "bloco" : "blocos"}</span>
            <span aria-hidden>·</span>
            <span>
              {blocks.reduce(
                (n, b) => n + (b.kind === "list" ? b.items.length : 0),
                0,
              )}{" "}
              bullet points
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="self-start rounded-pill border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-bg"
            aria-expanded={false}
          >
            Ver descrição completa ▾
          </button>
        </>
      )}

      {jobDescription && expanded && (
        <>
          {blocks.length > 0 ? (
            <JdBlocks blocks={blocks} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-[14px] leading-6 text-ink-2">
              {jobDescription}
            </pre>
          )}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="self-start rounded-pill border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-bg"
            aria-expanded={true}
          >
            Ver menos ▴
          </button>
        </>
      )}
    </article>
  );
}
