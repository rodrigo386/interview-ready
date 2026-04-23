"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  mergeCompleted,
  readLocalCompleted,
  resolveCurrentStep,
} from "@/lib/prep/step-state";
import type { PrepShellData, StepNumber } from "@/lib/prep/types";

const ShellContext = createContext<PrepShellData | null>(null);

export function PrepShellProvider({
  sessionId,
  company,
  role,
  estimatedMinutes,
  serverCompleted,
  children,
}: {
  sessionId: string;
  company: string;
  role: string;
  estimatedMinutes: number;
  serverCompleted: StepNumber[];
  children: ReactNode;
}) {
  const [completedSteps, setCompletedSteps] = useState<StepNumber[]>(serverCompleted);

  useEffect(() => {
    const local = readLocalCompleted(sessionId);
    setCompletedSteps(mergeCompleted(serverCompleted, local));

    const onStorage = (e: StorageEvent) => {
      if (e.key === `prepavaga:steps:${sessionId}`) {
        setCompletedSteps(mergeCompleted(serverCompleted, readLocalCompleted(sessionId)));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [sessionId, serverCompleted]);

  const currentStep = resolveCurrentStep(completedSteps);

  return (
    <ShellContext.Provider
      value={{ sessionId, company, role, estimatedMinutes, currentStep, completedSteps }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function usePrepShell(): PrepShellData {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("usePrepShell deve estar dentro de PrepShellProvider");
  return ctx;
}
