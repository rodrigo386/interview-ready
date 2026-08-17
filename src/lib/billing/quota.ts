export type ProfileBilling = {
  prep_credits: number;
};

export type QuotaCheck =
  | { allowed: true; mode: "credit" }
  | { allowed: false; mode: "block" };

/**
 * Modelo pós-2026-08-17: não existe preparação grátis nem assinatura. Gerar
 * a preparação completa consome 1 crédito; a análise ATS é gratuita e não
 * passa por aqui.
 *
 * As colunas `preps_used_this_month`, `preps_reset_at`,
 * `preps_this_billing_cycle` e `billing_cycle_started_at` deixaram de ser
 * lidas. Elas continuam no banco de propósito — dropar coluna e trocar
 * comportamento no mesmo deploy é o padrão que já derrubou este produto
 * (migration 0020). A remoção física é do Projeto 2.
 */
export function checkQuota(p: ProfileBilling, isAdmin: boolean): QuotaCheck {
  if (isAdmin) return { allowed: true, mode: "credit" };
  if (p.prep_credits > 0) return { allowed: true, mode: "credit" };
  return { allowed: false, mode: "block" };
}
