"use client";

import { useEffect, useRef, useState } from "react";
import type { PrepCard as PrepCardType } from "@/lib/ai/schemas";

const CONFIDENCE_STYLES: Record<PrepCardType["confidence_level"], string> = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  low: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
};

const CONFIDENCE_LABEL: Record<PrepCardType["confidence_level"], string> = {
  high: "alta confiança",
  medium: "média confiança",
  low: "baixa confiança",
};

export function PrepCard({
  card,
  defaultOpen = false,
}: {
  card: PrepCardType;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [defaultOpen]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.sample_answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      ref={ref}
      id={`card-${card.id}`}
      className="rounded-lg border border-border bg-bg scroll-mt-24"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 p-5 text-left hover:bg-surface-muted"
        aria-expanded={open}
      >
        <div className="flex-1">
          <h3 className="text-base font-medium text-text-primary">{card.question}</h3>
          <span
            className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${CONFIDENCE_STYLES[card.confidence_level]}`}
          >
            {CONFIDENCE_LABEL[card.confidence_level]}
          </span>
        </div>
        <span className="mt-1 text-text-tertiary" aria-hidden>
          {open ? "–" : "+"}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-border px-5 py-5">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              Pontos-chave
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-primary">
              {card.key_points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Resposta modelo
              </h4>
              <button
                type="button"
                onClick={copy}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-surface-muted"
              >
                {copied ? "✓ Copiado" : "📋 Copiar"}
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
              {card.sample_answer}
            </p>
          </section>

          {card.tips && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Dicas
              </h4>
              <p className="mt-2 text-sm italic text-text-secondary">{card.tips}</p>
            </section>
          )}

          {card.references_cv.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Puxa do seu CV
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {card.references_cv.map((r, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-secondary"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
