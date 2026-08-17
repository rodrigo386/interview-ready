import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Consome 1 crédito de forma atômica. O UPDATE condicional dentro de
 * `consume_prep_credit` (migration 0024) é o cadeado: duas abas concorrentes
 * com 1 crédito só geram uma prep.
 *
 * Falha do RPC barra a geração. Liberar em caso de erro entregaria a
 * preparação completa de graça, que é justamente o que o gate existe pra
 * impedir.
 */
export async function consumePrepCredit(
  supabase: SupabaseClient,
  userId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data, error } = await supabase.rpc("consume_prep_credit", {
    p_user_id: userId,
  });
  if (error) {
    console.warn(`[billing] consume_prep_credit falhou: ${error.message}`);
    return false;
  }
  return data === true;
}

/**
 * Devolve o crédito quando a geração falha. Nunca lança: já estamos no
 * caminho de erro, e uma exceção aqui esconderia a falha original.
 */
export async function refundPrepCredit(
  supabase: SupabaseClient,
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  if (isAdmin) return;
  const { error } = await supabase.rpc("refund_prep_credit", { p_user_id: userId });
  if (error) {
    console.warn(
      `[billing] refund_prep_credit falhou pro usuário ${userId}: ${error.message}`,
    );
  }
}
