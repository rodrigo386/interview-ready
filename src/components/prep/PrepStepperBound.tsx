"use client";

import { PrepStepper } from "./PrepStepper";
import { usePrepShell } from "./PrepShellProvider";

export function PrepStepperBound() {
  const { currentStep, completedSteps } = usePrepShell();
  return <PrepStepper currentStep={currentStep} completedSteps={completedSteps} />;
}
