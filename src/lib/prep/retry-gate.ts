import { isGenerationStale } from "./generation-stale";

export type RetryRecovery =
  | { kind: "failed_refunded" }
  | { kind: "zombie_unrefunded" }
  | { kind: "still_running" }
  | { kind: "not_retryable" };

export type RetryRecoveryInput = {
  generationStatus: "pending" | "generating" | "complete" | "failed" | null;
  /** `session.updated_at ?? session.created_at` — mesma fonte que o layout usa. */
  updatedAt: string | null;
  now: number;
};

/**
 * Decide, a partir do estado JÁ LIDO do banco no momento da chamada, se o
 * crédito gasto pela tentativa anterior já voltou pro saldo — e portanto se
 * um `retryPrep`/`deleteFailedPrep` deve cobrar/devolver
 * (`src/app/prep/new/actions.ts`).
 *
 * "failed": o pipeline (`runPipeline`, que nunca lança) ou o catch de
 * `runGenerationInBackground` já correu até o fim e já chamou
 * `refundPrepCredit` (ver `src/lib/billing/consume.ts`). O crédito está de
 * volta no saldo — tentar de novo é uma preparação nova, cobra. Não depende
 * de staleness: "failed" é sempre terminal.
 *
 * "pending"/"generating": aqui está o ponto que mudou na rodada 3 de
 * correção. A premissa antiga era "só chega em retryPrep já stale, porque só
 * o layout mostra PrepFailed nesse caso" — falsa: depois de um retry bem
 * sucedido em ganhar a corrida, a linha volta a "pending" FRESCO, e uma
 * SEGUNDA aba com o PrepFailed antigo ainda montado (ou um duplo clique) tenta
 * `retryPrep` de novo. Sem reavaliar staleness aqui dentro, esse segundo
 * clique seria classificado como zumbi (não cobra) e dispararia um SEGUNDO
 * `runGenerationInBackground` correndo em paralelo com o primeiro — dois
 * pipelines escrevendo na mesma linha, um deles apagando `prep_guide` no
 * meio da execução do outro.
 *
 * Por isso a checagem agora é feita com o mesmo critério do layout
 * (`isGenerationStale`, `src/lib/prep/generation-stale.ts`, 15 min desde
 * `updated_at`): só quando a linha está de fato velha é que tratamos como
 * zumbi (processo morreu, ninguém devolveu, retry não cobra). Uma linha
 * pending/generating recente é uma geração genuinamente em andamento —
 * "still_running" — e o retry deve RECUSAR, não resetar por baixo dela.
 *
 * "complete" ou `null`: nada a recuperar — os call sites já redirecionam
 * pra longe antes de perguntar isso pra prep completa; existe aqui só pra
 * cobrir o caso defensivamente sem lançar.
 */
export function classifyRetryRecovery(input: RetryRecoveryInput): RetryRecovery {
  const { generationStatus, updatedAt, now } = input;
  if (generationStatus === "failed") return { kind: "failed_refunded" };
  if (generationStatus === "pending" || generationStatus === "generating") {
    return isGenerationStale(generationStatus, updatedAt, now)
      ? { kind: "zombie_unrefunded" }
      : { kind: "still_running" };
  }
  return { kind: "not_retryable" };
}
