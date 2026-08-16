import { isClaimedAtsOnlyPrep, type GenerationGateInput } from "./generation-gate";

/**
 * Decisão de "gerar a preparação completa a partir de uma prep que já
 * existe". O caso real é a prep reivindicada da ferramenta ATS anônima:
 * nasce com `generation_status: "pending"`, `prep_guide: null` e
 * `ats_status: "complete"`, e nada dispara o pipeline pra ela.
 *
 * Antes disso ela era um beco sem saída: `retryPrep` só é alcançável pela
 * tela `PrepFailed` (que essa prep nunca renderiza) e `/prep/new` com a mesma
 * vaga bate na detecção de duplicata e manda "abrir prep existente".
 */
export type FullPrepDecision =
  /** Elegível: passa pelo gate de cota e dispara o pipeline. */
  | { kind: "generate" }
  /** Já tem guia — não há o que gerar. */
  | { kind: "already_generated" }
  /**
   * Há um pipeline dono desta linha: prep normal recém-criada, ou uma prep
   * em retry (que grava `pending` + `prep_guide: null` e fica alguns instantes
   * indistinguível de "parada" até o pipeline escrever).
   */
  | { kind: "already_running" }
  /**
   * `failed` — cujo caminho de recuperação é o `retryPrep` do `PrepFailed`,
   * de propósito gratuito — e estados sem status.
   */
  | { kind: "not_eligible" };

export function decideFullPrepGeneration(
  input: GenerationGateInput,
): FullPrepDecision {
  if (isClaimedAtsOnlyPrep(input)) return { kind: "generate" };
  if (input.generationStatus === "complete") return { kind: "already_generated" };
  if (input.prepGuide !== null && input.prepGuide !== undefined) {
    return { kind: "already_generated" };
  }
  if (input.generationStatus === "generating" || input.generationStatus === "pending") {
    return { kind: "already_running" };
  }
  return { kind: "not_eligible" };
}

/**
 * O CTA "gerar a preparação completa" só faz sentido no mesmo estado em que a
 * geração é permitida. Mesma fonte de verdade da action — a UI nunca oferece
 * um botão que o servidor vai recusar.
 */
export function shouldOfferFullPrep(input: GenerationGateInput): boolean {
  return decideFullPrepGeneration(input).kind === "generate";
}
