/**
 * A ÚNICA fonte de verdade sobre dinheiro de uma prep: as colunas
 * `credit_consumed_at` / `credit_refunded_at` de `prep_sessions`
 * (migration 0024).
 *
 * Elas existem porque as três rodadas anteriores desta task decidiam cobrança
 * a partir do `generation_status` — que é volátil (o pipeline reescreve a cada
 * tentativa, um retry bem-sucedido devolve a linha pra "pending") e, até
 * agora, era gravável pelo próprio usuário com a anon key. Toda rodada fechava
 * um buraco e abria o inverso: ou cobrava duas vezes pela mesma preparação, ou
 * gerava de graça. Estas duas colunas só mudam quando o dinheiro de fato muda
 * de mão, dentro do mesmo UPDATE condicional que move o saldo
 * (`consume_prep_credit` / `refund_prep_credit`), e nenhum cliente tem GRANT
 * pra escrevê-las.
 */
export type CreditLifecycle = {
  /** `null` = esta sessão nunca consumiu crédito. */
  creditConsumedAt: string | null | undefined;
  /** `null` = o crédito consumido ainda não voltou pro saldo. */
  creditRefundedAt: string | null | undefined;
};

/**
 * "O crédito desta sessão está PENDENTE DE USO": saiu do saldo e ainda não
 * voltou. Em dinheiro: a pessoa já pagou por uma preparação que ainda não
 * recebeu.
 *
 * É a única pergunta que os dois gates precisam fazer, em direções opostas:
 * quem tem crédito pendente não pode ser cobrado de novo (já pagou), e quem
 * tem crédito pendente é exatamente quem deve receber a devolução se a sessão
 * for embora sem entregar nada.
 */
export function isCreditOutstanding(c: CreditLifecycle): boolean {
  return Boolean(c.creditConsumedAt) && !c.creditRefundedAt;
}

/**
 * Cobra uma nova tentativa? Sim quando o crédito NÃO está pendente de uso:
 *
 * - `credit_consumed_at` nulo — nunca chegou a consumir. Cobre o caso do
 *   processo que morre entre o INSERT da sessão e o RPC de consumo: 15 min
 *   depois a linha `pending` vira "tentar novamente", e sem esta checagem
 *   geraria de graça.
 * - `credit_refunded_at` preenchido — a falha anterior já devolveu o crédito
 *   pro saldo, então esta tentativa é uma preparação nova e paga.
 *
 * Caso contrário (consumido e não devolvido), NÃO cobra: a pessoa pagou por
 * uma preparação que nunca chegou. Cobre tanto o zumbi (processo morto antes
 * de devolver) quanto o `failed` cuja devolução não aconteceu — situações em
 * que o `generation_status` mente sobre o estado do crédito e as colunas não.
 */
export function shouldChargeRetry(c: CreditLifecycle): boolean {
  return !isCreditOutstanding(c);
}

/**
 * Devolve o crédito ao descartar a sessão? Só quando ele está pendente de uso
 * — pagou e não recebeu. Se nunca consumiu, não há o que devolver; se já foi
 * devolvido, devolver de novo pagaria duas vezes o mesmo erro.
 */
export function shouldRefundOnDiscard(c: CreditLifecycle): boolean {
  return isCreditOutstanding(c);
}
