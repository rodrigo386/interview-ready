"use client";

import { PrepStepper } from "./PrepStepper";
import { usePrepShell } from "./PrepShellProvider";

export function PrepStepperBound() {
  const { sessionId, currentStep, completedSteps } = usePrepShell();
  return (
    <PrepStepper
      sessionId={sessionId}
      currentStep={currentStep}
      completedSteps={completedSteps}
    />
  );
}
