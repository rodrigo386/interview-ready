"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard, type QuestionSection } from "./QuestionCard";
import { markStepComplete } from "@/lib/prep/step-state";
import type { Accent, StepNumber } from "@/lib/prep/types";

/**
 * Pre-built page data. JSX (React elements) serializes across the
 * server→client RSC boundary; closures do not. Server pages must build
 * `sections` arrays before passing to this client component.
 */
export type PagerPage = {
  title: string;
  sections: QuestionSection[];
  chips?: string[];
};

export function QuestionPager({
  accent,
  pages,
  defaultMeta,
  step,
  sessionId,
  nextHref,
  nextStepCtaLabel,
  perQuestionCtaLabel = "Próxima pergunta →",
}: {
  accent: Accent;
  pages: PagerPage[];
  defaultMeta?: string;
  step: StepNumber;
  sessionId: string;
  nextHref: string;
  nextStepCtaLabel: string;
  perQuestionCtaLabel?: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const total = pages.length;
  const page = pages[index];
  const isLast = index === total - 1;

  const goNext = () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    markStepComplete(sessionId, step);
    router.push(nextHref);
  };

  const goPrev = index > 0 ? () => setIndex((i) => i - 1) : undefined;

  return (
    <QuestionCard
      accent={accent}
      questionNumber={`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
      title={page.title}
      sections={page.sections}
      chips={page.chips}
      meta={defaultMeta}
      ctaLabel={isLast ? nextStepCtaLabel : perQuestionCtaLabel}
      onNext={goNext}
      onPrev={goPrev}
    />
  );
}
