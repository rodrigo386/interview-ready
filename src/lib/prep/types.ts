export type StepNumber = 1 | 2 | 3 | 4 | 5;
export type Accent = "orange" | "yellow" | "green";

export const STEP_LABELS: Record<StepNumber, string> = {
  1: "Vaga",
  2: "CV",
  3: "Básicas",
  4: "Aprofundamento",
  5: "Você pergunta",
};

export type PrepShellData = {
  sessionId: string;
  company: string;
  role: string;
  // null quando prep_guide ainda não existe (prep reivindicada da
  // ferramenta ATS anônima) — nesse caso não há estimativa pra mostrar.
  estimatedMinutes: number | null;
  currentStep: StepNumber;
  completedSteps: StepNumber[];
  /** Saldo de créditos de preparação do dono da prep. O CTA de gerar
   * precisa dele para decidir entre "usa 1 das suas N" e mostrar o preço. */
  prepCredits: number;
};
