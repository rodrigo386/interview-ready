import type { StepNumber } from "./types";

export function computeServerCompleted(input: {
  guideReady: boolean;
  atsComplete: boolean;
}): StepNumber[] {
  const out: StepNumber[] = [];
  if (input.guideReady) out.push(1);
  if (input.guideReady && input.atsComplete) out.push(2);
  return out;
}

const VALID = new Set<number>([1, 2, 3, 4, 5]);

export function mergeCompleted(
  server: StepNumber[],
  local: number[],
): StepNumber[] {
  const set = new Set<number>([...server, ...local].filter((n) => VALID.has(n)));
  return [...set].sort((a, b) => a - b) as StepNumber[];
}

export function resolveCurrentStep(completed: StepNumber[]): StepNumber {
  for (let s = 1; s <= 5; s++) {
    if (!completed.includes(s as StepNumber)) return s as StepNumber;
  }
  return 5;
}

export const STORAGE_KEY = (sessionId: string) => `prepavaga:steps:${sessionId}`;

export function readLocalCompleted(sessionId: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function writeLocalCompleted(sessionId: string, steps: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY(sessionId), JSON.stringify(steps));
  } catch {
    // quota / disabled — silently no-op
  }
}

export function markStepComplete(sessionId: string, step: StepNumber): void {
  const cur = readLocalCompleted(sessionId);
  if (cur.includes(step)) return;
  writeLocalCompleted(sessionId, [...cur, step]);
}
