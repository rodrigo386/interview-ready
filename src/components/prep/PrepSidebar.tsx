"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrepShell } from "./PrepShellProvider";
import { STEP_LABELS, type StepNumber } from "@/lib/prep/types";

type Item = {
  step: StepNumber;
  segment: "" | "ats" | "likely" | "deep-dive" | "ask";
  icon: string;
  shortLabel: string;
};

// Sidebar items in display order, mapped to the 5 routes.
// segment="" → root /prep/[id] (Visão geral). Others append to the prep id.
const ITEMS: Item[] = [
  { step: 1, segment: "", icon: "🏠", shortLabel: "Visão geral" },
  { step: 2, segment: "ats", icon: "📊", shortLabel: "Compatibilidade ATS" },
  { step: 3, segment: "likely", icon: "💬", shortLabel: "Perguntas básicas" },
  { step: 4, segment: "deep-dive", icon: "🔥", shortLabel: "Aprofundamento" },
  { step: 5, segment: "ask", icon: "❓", shortLabel: "Você pergunta" },
];

export function PrepSidebar() {
  const { sessionId, completedSteps, currentStep } = usePrepShell();
  const pathname = usePathname();
  const completed = new Set(completedSteps);

  return (
    <nav
      aria-label="Navegação do prep"
      className="hidden lg:block sticky top-6 self-start"
    >
      <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
        Conteúdos
      </p>
      <ul className="space-y-1">
        {ITEMS.map((item) => {
          const href = item.segment
            ? `/prep/${sessionId}/${item.segment}`
            : `/prep/${sessionId}`;
          const isActive = pathname === href;
          const isCompleted = completed.has(item.step);
          const isCurrent = currentStep === item.step && !isActive;

          return (
            <li key={item.step}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
                  isActive
                    ? "bg-orange-soft text-orange-700 font-semibold"
                    : "text-ink-2 hover:bg-bg hover:text-ink",
                ].join(" ")}
              >
                <span aria-hidden className="text-base leading-none">
                  {item.icon}
                </span>
                <span className="flex-1 truncate">
                  {item.shortLabel}
                </span>
                <StatusDot
                  state={
                    isCompleted ? "done" : isCurrent ? "current" : "pending"
                  }
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 px-3 text-[11px] text-ink-3">
        {STEP_LABELS[currentStep]} · etapa {currentStep} de 5
      </p>
    </nav>
  );
}

function StatusDot({ state }: { state: "done" | "current" | "pending" }) {
  const cls =
    state === "done"
      ? "bg-green-500"
      : state === "current"
      ? "bg-orange-500"
      : "border border-line bg-transparent";
  const label =
    state === "done" ? "concluída" : state === "current" ? "atual" : "futura";
  return (
    <span
      aria-label={`Etapa ${label}`}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`}
    />
  );
}
