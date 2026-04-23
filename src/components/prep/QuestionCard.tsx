import type { ReactNode } from "react";
import { Chip } from "./Chip";
import type { Accent } from "@/lib/prep/types";

const ACCENT_HEADER_BG: Record<Accent, string> = {
  orange: "bg-orange-soft",
  yellow: "bg-yellow-soft",
  green: "bg-green-soft",
};
const ACCENT_HEADING: Record<Accent, string> = {
  orange: "text-orange-700",
  yellow: "text-yellow-700",
  green: "text-green-700",
};
const ACCENT_NUMBER_BG: Record<Accent, string> = {
  orange: "bg-orange-500",
  yellow: "bg-yellow-700",
  green: "bg-green-700",
};

export type QuestionSection = { heading: string; body: ReactNode };

export function QuestionCard({
  accent,
  questionNumber,
  title,
  sections,
  chips,
  meta,
  ctaLabel = "Próxima pergunta →",
  onNext,
  onPrev,
}: {
  accent: Accent;
  questionNumber: string;
  title: string;
  sections: QuestionSection[];
  chips?: string[];
  meta?: string;
  ctaLabel?: string;
  onNext: () => void;
  onPrev?: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white shadow-prep">
      <header className={`flex items-center justify-between px-6 py-4 ${ACCENT_HEADER_BG[accent]}`}>
        <span
          className={`inline-flex items-center justify-center rounded-pill px-3 py-1 text-xs font-bold text-white ${ACCENT_NUMBER_BG[accent]}`}
        >
          {questionNumber}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Pergunta anterior"
            disabled={!onPrev}
            onClick={onPrev}
            className="inline-flex h-9 w-9 items-center justify-center rounded-pill border border-line bg-white text-ink-2 disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Próxima pergunta"
            onClick={onNext}
            className="inline-flex h-9 w-9 items-center justify-center rounded-pill border border-line bg-white text-ink-2"
          >
            →
          </button>
        </div>
      </header>
      <div className="px-6 py-7 md:px-7">
        <h3 className="text-xl font-bold leading-snug text-ink">{title}</h3>
        <div className="mt-6 space-y-5">
          {sections.map((s, i) => (
            <section key={i}>
              <h4 className={`text-sm font-bold ${ACCENT_HEADING[accent]}`}>{s.heading}</h4>
              <div className="mt-2 text-[15px] leading-6 text-ink-2">{s.body}</div>
            </section>
          ))}
          {chips && chips.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {chips.map((c) => (
                <Chip key={c} variant="orange">
                  {c}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>
      <footer className="flex items-center justify-between gap-4 border-t border-line bg-bg px-6 py-4">
        <span className="text-[13px] text-ink-3">{meta ?? ""}</span>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-prep transition-colors hover:bg-orange-700"
        >
          {ctaLabel}
        </button>
      </footer>
    </article>
  );
}
