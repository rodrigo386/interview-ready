"use client";

import { useState } from "react";
import type { CvRewrite } from "@/lib/ai/schemas";
import { runCvRewrite } from "@/app/prep/[id]/rewrite-actions";
import { PendingButton } from "./PendingButton";
import { renderMarkdown } from "@/lib/files/render-markdown";

export function CvRewriteView({
  rewrite,
  sessionId,
}: {
  rewrite: CvRewrite;
  sessionId: string;
}) {
  const [copied, setCopied] = useState(false);
  const rerunAction = runCvRewrite.bind(null, sessionId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rewrite.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-8 rounded-md border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold text-zinc-100">
        🎯 CV otimizado para ATS
      </h3>

      <section className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Resumo das mudanças
        </h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
          {rewrite.summary_of_changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>

      {rewrite.preserved_facts.length > 0 && (
        <section className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Fatos preservados (mantidos literalmente)
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {rewrite.preserved_facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Prévia
        </h4>
        <div className="mt-2 max-h-96 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-4">
          {renderMarkdown(rewrite.markdown)}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          {copied ? "✓ Copiado" : "📋 Copiar markdown"}
        </button>
        <a
          href={`/prep/${sessionId}/cv-rewrite.docx`}
          download
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          📄 Baixar .docx
        </a>
        <form action={rerunAction}>
          <PendingButton
            idleLabel="↻ Refazer"
            pendingLabel="Refazendo…"
            variant="secondary"
          />
        </form>
      </div>
    </div>
  );
}
