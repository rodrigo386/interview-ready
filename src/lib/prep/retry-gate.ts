import { isGenerationStale } from "./generation-stale";

export type RetryRecovery =
  | { kind: "retryable" }
  | { kind: "still_running" }
  | { kind: "not_retryable" };

export type RetryRecoveryInput = {
  generationStatus: "pending" | "generating" | "complete" | "failed" | null;
  /** `session.updated_at ?? session.created_at` — mesma fonte que o layout usa. */
  updatedAt: string | null;
  now: number;
};

/**
 * Decide se a geração desta sessão PODE ser reiniciada ou descartada agora —
 * e só isso. Quem decide dinheiro é `src/lib/billing/credit-lifecycle.ts`, a
 * partir de `credit_consumed_at`/`credit_refunded_at`.
 *
 * Essa separação é a correção da rodada 4: até aqui a classificação devolvia
 * `failed_refunded` / `zombie_unrefunded`, ou seja, afirmava sobre o CRÉDITO a
 * partir do `generation_status`. O nome mentia sempre que a devolução não
 * tinha acontecido de fato (RPC com erro, processo morto depois de gravar
 * "failed"), e cobrava de novo uma preparação que a pessoa já tinha pago.
 * `generation_status` diz o que aconteceu com a GERAÇÃO; o que aconteceu com o
 * dinheiro está gravado nas colunas de crédito, que só mudam junto com o
 * saldo.
 *
 * - "failed": desfecho terminal, sempre reiniciável.
 * - "pending"/"generating" além do threshold de stale (`isGenerationStale`,
 *   15 min desde `updated_at` — mesmo critério do layout): zumbi, o processo
 *   que geraria morreu. Reiniciável.
 * - "pending"/"generating" recente: geração genuinamente em andamento. NÃO
 *   pode ser reiniciada nem apagada por baixo do runner que está escrevendo
 *   na linha. A premissa antiga ("só chega aqui já stale, porque só o layout
 *   mostra PrepFailed") quebra depois de um retry ganhar a corrida: a linha
 *   volta a "pending" FRESCO e uma segunda aba com a tela antiga dispararia
 *   um segundo pipeline em paralelo.
 * - "complete" ou `null`: nada a recuperar. Os call sites redirecionam pra
 *   prep sem tocar em nada — em especial `deleteFailedPrep`, que num
 *   "complete" estaria apagando uma preparação ENTREGUE e (por ela ainda
 *   constar como consumida e não devolvida) devolvendo o crédito dela.
 */
export function classifyRetryRecovery(input: RetryRecoveryInput): RetryRecovery {
  const { generationStatus, updatedAt, now } = input;
  if (generationStatus === "failed") return { kind: "retryable" };
  if (generationStatus === "pending" || generationStatus === "generating") {
    return isGenerationStale(generationStatus, updatedAt, now)
      ? { kind: "retryable" }
      : { kind: "still_running" };
  }
  return { kind: "not_retryable" };
}
