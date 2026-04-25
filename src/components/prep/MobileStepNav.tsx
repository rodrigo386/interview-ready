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
  const prev = currentStep > 1 ? ((currentStep - 1) as StepNumber) : null;
  const next = currentStep < 5 ? ((currentStep + 1) as StepNumber) : null;

  return (
    <nav
      aria-label="Navegação entre etapas"
      className="sticky bottom-0 left-0 right-0 z-30 mt-4 -mx-4 border-t border-line bg-white/95 px-3 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] backdrop-blur md:-mx-6 lg:hidden"
    >
      <div className="flex items-center justify-between gap-2">
        {prev ? (
          <Link
            href={hrefFor(sessionId, prev)}
            className="flex-1 rounded-md border border-line bg-white px-3 py-2.5 text-left text-sm font-semibold text-ink-2 transition-colors active:bg-bg"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-3">
              ← Etapa {prev}
            </span>
            <span className="block truncate text-[13px]">
              {STEP_LABELS[prev]}
            </span>
          </Link>
        ) : (
          <Link
            href="/dashboard"
            className="flex-1 rounded-md border border-line bg-white px-3 py-2.5 text-left text-sm font-semibold text-ink-2 transition-colors active:bg-bg"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-3">
              ← Sair
            </span>
            <span className="block truncate text-[13px]">Dashboard</span>
          </Link>
        )}

        {next ? (
          <Link
            href={hrefFor(sessionId, next)}
            className="flex-1 rounded-md bg-orange-500 px-3 py-2.5 text-right text-sm font-semibold text-white shadow-prep transition-colors active:bg-orange-700"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wide text-white/80">
              Etapa {next} →
            </span>
            <span className="block truncate text-[13px]">{STEP_LABELS[next]}</span>
          </Link>
        ) : (
          <Link
            href={`/prep/${sessionId}`}
            className="flex-1 rounded-md bg-green-500 px-3 py-2.5 text-right text-sm font-semibold text-white shadow-prep transition-colors active:bg-green-700"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wide text-white/80">
              Voltar pro topo
            </span>
            <span className="block truncate text-[13px]">Visão geral</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
