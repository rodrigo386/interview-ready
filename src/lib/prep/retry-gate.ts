export type RetryRecovery =
  | { kind: "failed_refunded" }
  | { kind: "zombie_unrefunded" }
  | { kind: "not_retryable" };

/**
 * Decide, a partir do `generation_status` já lido do banco, se o crédito
 * gasto pela tentativa anterior já voltou pro saldo — e portanto se um
 * `retryPrep` deve cobrar de novo (`src/app/prep/new/actions.ts`).
 *
 * "failed": o pipeline (`runPipeline`, que nunca lança) ou o catch de
 * `runGenerationInBackground` já correu até o fim e já chamou
 * `refundPrepCredit` (ver `src/lib/billing/consume.ts`). O crédito está de
 * volta no saldo — tentar de novo é uma preparação nova, cobra.
 *
 * "pending"/"generating" travados: só chegam em `retryPrep` via
 * `PrepFailed`, que só renderiza esse estado quando `isGenerationStale` já
 * passou do threshold (`src/lib/prep/generation-stale.ts`) — ou seja, o
 * processo que geraria (e devolveria em caso de falha) morreu no meio,
 * redeploy ou crash. NINGUÉM devolveu o crédito, porque o runner que faria
 * isso morreu junto. Cobrar de novo aqui pagaria duas vezes pela mesma
 * preparação que nunca chegou — o retry aqui é grátis porque está só
 * resumindo uma tentativa que já foi paga.
 *
 * "complete" ou `null`: nada a recuperar — `retryPrep` já redireciona pra
 * longe antes de perguntar isso pra prep completa; existe aqui só pra
 * cobrir o caso defensivamente sem lançar.
 */
export function classifyRetryRecovery(
  generationStatus: "pending" | "generating" | "complete" | "failed" | null,
): RetryRecovery {
  if (generationStatus === "failed") return { kind: "failed_refunded" };
  if (generationStatus === "pending" || generationStatus === "generating") {
    return { kind: "zombie_unrefunded" };
  }
  return { kind: "not_retryable" };
}
