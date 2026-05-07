import { SECTION_KINDS } from "@/lib/ai/prompts/section-generator";
import type { PrepProgressStep } from "@/lib/prep/load-session";
import { PrepSkeletonRefresh } from "./PrepSkeletonRefresh";

/**
 * Ordered pipeline steps shown to the user. Mirrors what runPipeline does:
 * Stage A (company_research) → Stage B (5 sections sequentially).
 * The keys here MUST match the values pipeline.ts writes to
 * `prep_sessions.progress_step`.
 */
const PIPELINE_STEPS: { key: NonNullable<PrepProgressStep>; label: string }[] = [
  { key: "company_research", label: "Pesquisando a empresa" },
  { key: "likely", label: "Perguntas prováveis" },
  { key: "deep-dive", label: "Perguntas de aprofundamento" },
  { key: "tricky", label: "Perguntas difíceis" },
  { key: "questions-to-ask", label: "Perguntas para o recrutador" },
  { key: "mindset", label: "Mindset & dicas finais" },
];

const TOTAL_SECTIONS = SECTION_KINDS.length;

export function PrepSkeleton({
  progressStep = null,
  companyIntelStatus = null,
}: {
  progressStep?: PrepProgressStep;
  /** "researching" | "complete" | "failed" | "skipped" — used to show the
   *  Stage-A step as ✓ or ✗ once we move past it. */
  companyIntelStatus?: string | null;
}) {
  // Find current index in PIPELINE_STEPS based on progress_step.
  // If progressStep is null (just started or already done), default to -1 so
  // nothing is "current" yet.
  const currentIndex = progressStep
    ? PIPELINE_STEPS.findIndex((s) => s.key === progressStep)
    : -1;

  // For the "Gerando 3/5" counter, only sections count (skip company_research).
  const sectionIndexInPipeline = currentIndex - 1; // 0-based section index, -1 if on company_research
  const isOnSection = sectionIndexInPipeline >= 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PrepSkeletonRefresh />
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 animate-pulse rounded-full bg-brand-600" />
          <p className="text-base font-semibold text-text-primary">
            {currentLabel({ progressStep, sectionIndexInPipeline, isOnSection })}
          </p>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Pesquisando a empresa e gerando seu dossiê. Costuma levar de 2 a 3 minutos —
          a página atualiza sozinha quando estiver pronto.
        </p>

        <ul className="mt-6 space-y-2.5">
          {PIPELINE_STEPS.map((step, i) => {
            const status: "done" | "current" | "pending" =
              currentIndex === -1
                ? "pending"
                : i < currentIndex
                  ? "done"
                  : i === currentIndex
                    ? "current"
                    : "pending";

            // Special-case: company_research can be "skipped" or "failed"
            // even when we've already moved past it. Reflect that.
            const isCompanyStep = step.key === "company_research";
            const companyDone =
              isCompanyStep && i < currentIndex && companyIntelStatus === "complete";
            const companySkipped =
              isCompanyStep &&
              i < currentIndex &&
              (companyIntelStatus === "skipped" || companyIntelStatus === "failed");

            return (
              <li key={step.key} className="flex items-center gap-3 text-sm">
                <StatusIcon status={status} skipped={companySkipped} done={companyDone || status === "done"} />
                <span
                  className={
                    status === "current"
                      ? "font-semibold text-text-primary"
                      : status === "done"
                        ? "text-text-primary"
                        : "text-text-secondary"
                  }
                >
                  {step.label}
                  {isOnSection && step.key === PIPELINE_STEPS[currentIndex]?.key && (
                    <span className="ml-2 text-xs font-normal text-text-tertiary">
                      ({sectionIndexInPipeline + 1}/{TOTAL_SECTIONS})
                    </span>
                  )}
                  {companySkipped && (
                    <span className="ml-2 text-xs font-normal text-text-tertiary">
                      (pulado)
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-xs text-text-muted">
          Pode deixar essa aba aberta — atualiza sozinha. Se levar mais de 4 minutos, recarregue.
        </p>
      </div>

      <div className="mt-10 -mx-2 flex gap-2 overflow-x-auto px-2 pb-2">
        {Array.from({ length: SECTION_KINDS.length + 1 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-32 shrink-0 animate-pulse rounded-full border border-border bg-surface"
          />
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {SECTION_KINDS.map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}

function StatusIcon({
  status,
  skipped,
  done,
}: {
  status: "done" | "current" | "pending";
  skipped?: boolean;
  done?: boolean;
}) {
  if (skipped) {
    return (
      <span
        aria-hidden
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-text-tertiary text-xs text-white"
      >
        −
      </span>
    );
  }
  if (status === "done" || done) {
    return (
      <span
        aria-hidden
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white"
      >
        ✓
      </span>
    );
  }
  if (status === "current") {
    return (
      <span
        aria-hidden
        className="inline-flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-brand-600 text-xs text-white"
      >
        ⏳
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs text-text-tertiary"
    >
      ○
    </span>
  );
}

function currentLabel(args: {
  progressStep: PrepProgressStep;
  sectionIndexInPipeline: number;
  isOnSection: boolean;
}): string {
  if (!args.progressStep) return "Gerando seu dossiê";
  const step = PIPELINE_STEPS.find((s) => s.key === args.progressStep);
  if (!step) return "Gerando seu dossiê";
  if (args.isOnSection) {
    return `Gerando ${args.sectionIndexInPipeline + 1}/${TOTAL_SECTIONS}: ${step.label}`;
  }
  return step.label;
}
