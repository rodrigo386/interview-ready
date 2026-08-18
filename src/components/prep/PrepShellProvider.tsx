"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  mergeCompleted,
  readLocalCompleted,
  resolveCurrentStep,
  writeLocalCompleted,
} from "@/lib/prep/step-state";
import type { PrepShellData, StepNumber } from "@/lib/prep/types";

type ShellContextValue = PrepShellData & {
  markStepComplete: (step: StepNumber) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function PrepShellProvider({
  sessionId,
  company,
  role,
  estimatedMinutes,
  serverCompleted,
  prepCredits,
  children,
}: {
  sessionId: string;
  company: string;
  role: string;
  estimatedMinutes: number | null;
  serverCompleted: StepNumber[];
  prepCredits: number;
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

  // Same-tab markComplete: update state immediately AND persist to localStorage.
  // (Cross-tab updates already arrive via the storage event listener above.)
  const markStepComplete = useCallback(
    (step: StepNumber) => {
      setCompletedSteps((prev) => {
        if (prev.includes(step)) return prev;
        const next = mergeCompleted(prev, [step]);
        writeLocalCompleted(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  return (
    <ShellContext.Provider
      value={{
        sessionId,
        company,
        role,
        estimatedMinutes,
        prepCredits,
        currentStep,
        completedSteps,
        markStepComplete,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

/**
 * Versão que não explode fora do provider. Existe porque o CTA de gerar a
 * preparação é renderizado também em testes de componente isolados, onde não
 * há shell em volta — nesses casos o saldo é desconhecido e o componente cai
 * no comportamento neutro em vez de derrubar a árvore.
 */
export function usePrepShellOptional(): ShellContextValue | null {
  return useContext(ShellContext);
}

export function usePrepShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("usePrepShell deve estar dentro de PrepShellProvider");
  return ctx;
}
