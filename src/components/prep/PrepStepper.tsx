import { STEP_LABELS, type StepNumber } from "@/lib/prep/types";

const STEPS: StepNumber[] = [1, 2, 3, 4, 5];

export function PrepStepper({
  currentStep,
  completedSteps,
}: {
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
        className="grid grid-cols-5 gap-2"
      >
        {STEPS.map((step) => {
          const isCompleted = completed.has(step);
          const isCurrent = step === currentStep;
          const bg = isCompleted
            ? "bg-green-500"
            : isCurrent
            ? "bg-orange-500"
            : "bg-line";
          return (
            <div key={step} className="relative">
              <div
                data-testid={`stepper-segment-${step}`}
                className={`h-2 rounded-pill ${bg}`}
                aria-label={
                  isCompleted
                    ? `Etapa ${step} concluída`
                    : isCurrent
                    ? `Etapa ${step} atual`
                    : `Etapa ${step} futura`
                }
              />
              {isCurrent && (
                <span
                  aria-hidden
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-[3px] border-white bg-orange-500 shadow-[0_0_0_4px_rgba(241,90,36,0.18)]"
                />
              )}
              <span className="mt-2 hidden text-[12px] font-semibold text-ink-3 md:block">
                {STEP_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
