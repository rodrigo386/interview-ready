"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard, type QuestionSection } from "./QuestionCard";
import { markStepComplete } from "@/lib/prep/step-state";
import type { Accent, StepNumber } from "@/lib/prep/types";
import type { PrepCard } from "@/lib/ai/schemas";

export function QuestionPager({
  accent,
  cards,
  buildSections,
  defaultMeta,
  step,
  sessionId,
  nextHref,
  nextStepCtaLabel,
  perQuestionCtaLabel = "Próxima pergunta →",
}: {
  accent: Accent;
  cards: PrepCard[];
  buildSections: (card: PrepCard) => QuestionSection[];
  defaultMeta?: string;
  step: StepNumber;
  sessionId: string;
  nextHref: string;
  nextStepCtaLabel: string;
  perQuestionCtaLabel?: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const total = cards.length;
  const card = cards[index];
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
      title={card.question}
      sections={buildSections(card)}
      chips={card.references_cv}
      meta={defaultMeta}
      ctaLabel={isLast ? nextStepCtaLabel : perQuestionCtaLabel}
      onNext={goNext}
      onPrev={goPrev}
    />
  );
}
