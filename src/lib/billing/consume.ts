import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Consome 1 crédito de forma atômica E registra o consumo NA SESSÃO
 * (`credit_consumed_at`, migration 0024). O UPDATE condicional em
 * `profiles` continua sendo o cadeado contra duplo consumo (duas abas
 * concorrentes com 1 crédito só geram uma prep); o registro na sessão é o
 * que torna a devolução idempotente — sem ele, `refund_prep_credit` não
 * tinha como saber se JÁ tinha devolvido esta sessão específica, e cada
 * rodada de correção fechava uma corrida abrindo outra (histórico completo
 * no relatório da Task 4, rodadas 1-3: dois runners paralelos devolvendo,
 * `deleteFailedPrep` devolvendo duas vezes, devolução indevida pra sessão
 * que nunca consumiu).
 *
 * Falha do RPC barra a geração. Liberar em caso de erro entregaria a
 * preparação completa de graça, que é justamente o que o gate existe pra
 * impedir.
 */
export async function consumePrepCredit(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data, error } = await supabase.rpc("consume_prep_credit", {
    p_user_id: userId,
    p_session_id: sessionId,
  });
  if (error) {
    console.warn(`[billing] consume_prep_credit falhou: ${error.message}`);
    return false;
  }
  return data === true;
}

/**
 * Devolve o crédito quando a geração falha — idempotente POR SESSÃO. O
 * UPDATE em `prep_sessions` dentro do RPC é o cadeado: só credita se
 * `credit_consumed_at` não for nulo E `credit_refunded_at` for nulo, e
 * marca `credit_refunded_at` no MESMO UPDATE que decide creditar. Chamar
 * isto duas vezes pra mesma sessão (dois runners paralelos, um retry que
 * também falha depois de já ter devolvido uma vez) credita no máximo uma
 * vez por consumo real — a segunda chamada é um no-op silencioso, não um
 * erro.
 *
 * Nunca lança: já estamos no caminho de erro, e uma exceção aqui esconderia
 * a falha original.
 */
export async function refundPrepCredit(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  isAdmin: boolean,
): Promise<void> {
  if (isAdmin) return;
  const { data, error } = await supabase.rpc("refund_prep_credit", {
    p_user_id: userId,
    p_session_id: sessionId,
  });
  if (error) {
    console.warn(
      `[billing] refund_prep_credit falhou pro usuário ${userId} sessão ${sessionId}: ${error.message}`,
    );
    return;
  }
  if (data !== true) {
    // Não é erro — é a idempotência funcionando: esta sessão já tinha sido
    // devolvida antes, ou nunca chegou a consumir nada.
    console.log(
      `[billing] refund_prep_credit no-op pra sessão ${sessionId} (já devolvido ou nunca consumido)`,
    );
  }
}

/**
 * Credita 1 de volta SEM nenhuma checagem de sessão. Só chame depois de já
 * ter garantido, por conta própria, que o crédito é devido exatamente uma
 * vez — hoje o único caller é `deleteFailedPrep`
 * (`src/app/prep/new/actions.ts`), que apaga a linha ANTES de decidir se
 * devolve (o DELETE condicional é o cadeado dele, e o retorno do DELETE já
 * prova o que era preciso provar). Nesse ponto a sessão já não existe mais
 * pra `refund_prep_credit` — que depende da linha existir — checar nada.
 * `refundPrepCredit` continua sendo o caminho normal em todo o resto.
 */
export async function creditPrepRefundUnconditional(
  supabase: SupabaseClient,
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  if (isAdmin) return;
  const { error } = await supabase.rpc("credit_prep_refund", { p_user_id: userId });
  if (error) {
    console.warn(
      `[billing] credit_prep_refund falhou pro usuário ${userId}: ${error.message}`,
    );
  }
}
