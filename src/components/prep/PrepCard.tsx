"use client";

import { useEffect, useRef, useState } from "react";
import type { PrepCard as PrepCardType } from "@/lib/ai/schemas";

const CONFIDENCE_STYLES: Record<PrepCardType["confidence_level"], string> = {
  high: "bg-emerald-950/40 text-emerald-300 border-emerald-900",
  medium: "bg-amber-950/40 text-amber-300 border-amber-900",
  low: "bg-red-950/40 text-red-300 border-red-900",
};

export function PrepCard({
  card,
  defaultOpen = false,
}: {
  card: PrepCardType;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [defaultOpen]);

  return (
    <div
      ref={ref}
      id={`card-${card.id}`}
      className="rounded-lg border border-zinc-800 bg-zinc-900/40 scroll-mt-24"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 p-5 text-left hover:bg-zinc-900/60"
        aria-expanded={open}
      >
        <div className="flex-1">
          <h3 className="text-base font-medium text-zinc-100">{card.question}</h3>
          <span
            className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${CONFIDENCE_STYLES[card.confidence_level]}`}
          >
            {card.confidence_level} confidence
          </span>
        </div>
        <span className="mt-1 text-zinc-500" aria-hidden>
          {open ? "–" : "+"}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-zinc-800 px-5 py-5">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Key points
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
              {card.key_points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Sample answer
            </h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {card.sample_answer}
            </p>
          </section>

          {card.tips && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Tips
              </h4>
              <p className="mt-2 text-sm italic text-zinc-300">{card.tips}</p>
            </section>
          )}

          {card.references_cv.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Draws from your CV
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {card.references_cv.map((r, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300"
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
