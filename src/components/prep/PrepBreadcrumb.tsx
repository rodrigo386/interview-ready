"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STEP_LABELS, type StepNumber } from "@/lib/prep/types";

const SEGMENT_TO_STEP: Record<string, StepNumber> = {
  ats: 2,
  likely: 3,
  "deep-dive": 4,
  ask: 5,
};

function detectStep(pathname: string, sessionId: string): StepNumber | null {
  const root = `/prep/${sessionId}`;
  if (pathname === root) return 1;
  const seg = pathname.replace(`${root}/`, "");
  return SEGMENT_TO_STEP[seg] ?? null;
}

export function PrepBreadcrumb({ sessionId }: { sessionId: string }) {
  const pathname = usePathname();
  const currentStep = detectStep(pathname, sessionId);
  const isOverview = pathname === `/prep/${sessionId}`;

  if (isOverview) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"
      >
        <span aria-hidden>←</span>
        <span>Dashboard</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={`/prep/${sessionId}`}
        className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"
      >
        <span aria-hidden>←</span>
        <span className="hidden sm:inline">Visão geral</span>
        <span className="sm:hidden">Voltar</span>
      </Link>
      {currentStep && (
        <>
          <span aria-hidden className="text-ink-3">·</span>
          <span className="text-ink-3">
            Etapa {currentStep} · <span className="font-semibold text-ink-2">{STEP_LABELS[currentStep]}</span>
          </span>
        </>
      )}
    </div>
  );
}
