"use client";

import Link from "next/link";
import { usePrepShell } from "./PrepShellProvider";
import { STEP_LABELS, type StepNumber } from "@/lib/prep/types";

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

export function MobileStepNav() {
  const { sessionId, currentStep } = usePrepShell();
  const onOverview = currentStep === 1;
  const next = currentStep < 5 ? ((currentStep + 1) as StepNumber) : null;
  const overviewHref = `/prep/${sessionId}`;

  return (
    <nav
      aria-label="Navegação entre etapas"
      className="sticky bottom-0 left-0 right-0 z-30 mt-4 -mx-4 border-t border-line bg-white/95 px-3 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur md:-mx-6 lg:hidden"
    >
      <div className="flex items-stretch gap-2">
        {onOverview ? (
          <Link
            href="/dashboard"
            className="flex flex-1 items-center justify-center rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-ink-2 transition-colors active:bg-bg"
          >
            ← Dashboard
          </Link>
        ) : (
          <Link
            href={overviewHref}
            className="flex flex-1 items-center justify-center rounded-lg border border-orange-500 bg-orange-soft px-4 py-3 text-sm font-semibold text-orange-700 transition-colors active:bg-orange-100"
          >
            🏠 Visão geral
          </Link>
        )}

        {next ? (
          <Link
            href={hrefFor(sessionId, next)}
            className="flex flex-1 items-center justify-center rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-prep transition-colors active:bg-orange-700"
          >
            <span className="truncate">
              {STEP_LABELS[next]} →
            </span>
          </Link>
        ) : (
          <Link
            href={overviewHref}
            className="flex flex-1 items-center justify-center rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-prep transition-colors active:bg-green-700"
          >
            ✓ Concluído
          </Link>
        )}
      </div>
    </nav>
  );
}
