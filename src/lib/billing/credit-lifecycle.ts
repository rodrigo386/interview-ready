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
 *
 * Usado pelo `deleteFailedPrep`, que só alcança sessões NÃO entregues (ele
 * barra `complete` antes de chegar aqui, via `classifyRetryRecovery`). Para o
 * caminho de exclusão que aceita qualquer sessão, ver `shouldRefundOnDelete`.
 */
export function shouldRefundOnDiscard(c: CreditLifecycle): boolean {
  return isCreditOutstanding(c);
}

/**
 * Devolve o crédito ao EXCLUIR uma sessão qualquer (`deletePrep`, o ícone de
 * lixeira que aparece em todo card do dashboard e na zona de perigo da Tela
 * 1)? Mesma pergunta do `shouldRefundOnDiscard` mais uma guarda, porque aqui
 * a entrada não é só sessão fracassada:
 *
 * uma preparação ENTREGUE tem exatamente o mesmo par de colunas de um crédito
 * pendente (`credit_consumed_at` preenchido, `credit_refunded_at` nulo) — a
 * marca de devolução só existe quando o dinheiro volta, e numa entrega
 * bem-sucedida ele não volta. Devolver aqui pagaria de volta algo que a pessoa
 * recebeu, e o dossiê continuaria exportado em PDF na máquina dela. Por isso
 * `complete` NÃO devolve.
 *
 * Quem distingue os dois casos é o `generation_status`, e ele só serve para
 * isso desde a migration 0024 (bloco 6), que tirou o GRANT de UPDATE dessa
 * coluna de `authenticated` — antes qualquer pessoa logada marcava a própria
 * prep entregue como "failed" pela anon key e pedia a devolução. É também uma
 * pergunta mais fraca do que a que o `retryPrep` faz: não "esta tentativa
 * pagou?" (volátil, reescrita a cada retry), e sim "esta sessão chegou a
 * entregar alguma coisa?" — e a resposta vem da linha que o próprio DELETE
 * acabou de apagar, então não há janela para ela mudar por baixo.
 *
 * O caso que motivou a guarda existir aqui é o inverso, e é determinístico:
 * um deploy mata o pipeline no meio, a sessão fica presa em `generating`, a
 * pessoa vê "Gerando…" travado e clica na lixeira. Sem esta função, o crédito
 * ia embora com a linha e não havia recurso.
 *
 * Entrega PARCIAL (`complete` com `meta.partial`) não precisa de tratamento
 * especial: o próprio pipeline já devolveu o crédito na hora de gravar o
 * parcial, então a linha chega aqui com `credit_refunded_at` preenchido e o
 * `isCreditOutstanding` a barra sozinho.
 */
export function shouldRefundOnDelete(
  c: CreditLifecycle & { generationStatus: string | null | undefined },
): boolean {
  if (c.generationStatus === "complete") return false;
  return isCreditOutstanding(c);
}
