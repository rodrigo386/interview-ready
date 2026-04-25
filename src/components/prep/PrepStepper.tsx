"use client";

import Link from "next/link";
import { STEP_LABELS, type StepNumber } from "@/lib/prep/types";

const STEPS: StepNumber[] = [1, 2, 3, 4, 5];

const SEGMENT_BY_STEP: Record<StepNumber, string> = {
  1: "",
  2: "ats",
  3: "likely",
  4: "deep-dive",
  5: "ask",
};

function hrefFor(sessionId: string, step: StepNumber): string {
  const seg = SEGMENT_BY_STEP[step];
  return seg ? `/prep/${sessionId}/${seg}` : `/prep/${sessionId}`;
}

export function PrepStepper({
  sessionId,
  currentStep,
  completedSteps,
}: {
  sessionId: string;
  currentStep: StepNumber;
  completedSteps: StepNumber[];
}) {
  const completed = new Set(completedSteps);

  return (
    <div className="w-full">
      <p
        data-testid="stepper-mobile-label"
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3 md:hidden"
      >
        Etapa {currentStep} de 5 · {STEP_LABELS[currentStep]}
      </p>
      <div
        role="progressbar"
        aria-label="Progresso do prep"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={5}
        className="grid grid-cols-5 gap-1.5 md:gap-2"
      >
        {STEPS.map((step) => {
          const isCompleted = completed.has(step);
          const isCurrent = step === currentStep;
          const bg = isCompleted
            ? "bg-green-500"
            : isCurrent
            ? "bg-orange-500"
            : "bg-line";
          const label = isCompleted
            ? `Etapa ${step} concluída — ${STEP_LABELS[step]}`
            : isCurrent
            ? `Etapa ${step} atual — ${STEP_LABELS[step]}`
            : `Ir para etapa ${step} — ${STEP_LABELS[step]}`;
          return (
            <Link
              key={step}
              href={hrefFor(sessionId, step)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={label}
              className="group relative block focus:outline-none"
            >
              <div
                data-testid={`stepper-segment-${step}`}
                className={`h-3 rounded-pill transition-all md:h-2 ${bg} group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-orange-500 group-focus-visible:ring-offset-2`}
              />
              {isCurrent && (
                <span
                  aria-hidden
                  className="absolute right-0 top-1.5 h-4 w-4 -translate-y-1/2 rounded-full border-[3px] border-white bg-orange-500 shadow-[0_0_0_4px_rgba(241,90,36,0.18)] md:top-1"
                />
              )}
              <span
                className={`mt-2 block truncate text-[10px] font-semibold leading-tight md:text-[12px] ${
                  isCurrent
                    ? "text-orange-700"
                    : isCompleted
                    ? "text-green-700"
                    : "text-ink-3"
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
