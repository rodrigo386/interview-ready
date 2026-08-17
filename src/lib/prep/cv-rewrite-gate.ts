export type CvRewriteAccessInput = {
  prepGuide: unknown;
  atsStatus: string | null;
} | null;

export type CvRewriteAccessDecision =
  | { kind: "allowed" }
  | { kind: "prep_not_found" }
  | { kind: "prep_guide_missing" }
  | { kind: "ats_not_complete" };

/**
 * Task 10 (fechamento do vazamento de receita da Task 8): decide se o CV
 * reescrito pode ser gerado/baixado para uma prep.
 *
 * O gate é `prep_guide` não nulo, não `ats_status === "complete"` sozinho.
 * Desde que a análise ATS virou grátis, exigir só `ats_status === "complete"`
 * deixava qualquer usuário logado gerar e baixar o CV reescrito — o
 * entregável vendido nos R$10 — sem pagar nada. `prep_guide` só existe numa
 * prep cuja preparação completa já foi gerada (pago via crédito avulso, Pro,
 * ou o free grátis vitalício), então é a marca de "já tem direito ao CV
 * reescrito incluso".
 *
 * Propositalmente NÃO consome nem devolve crédito — só lê colunas já
 * gravadas. Quem pagou os R$10 gerou a preparação (consumo já aconteceu em
 * `generateFullPrep`/`createPrep`); este gate não duplica esse fluxo, então
 * não herda os defeitos de corrida que levaram 4 rodadas de correção na
 * Task 4 (crédito consumido/devolvido por múltiplos escritores concorrentes).
 *
 * `ats_status === "complete"` continua exigido mesmo com `prep_guide`
 * presente: o prompt de reescrita usa `top_fixes` da análise ATS
 * (`rewrite-actions.ts`), então sem análise pronta não há o que reescrever.
 *
 * Usada pelos três pontos que precisam da mesma decisão: `runCvRewrite`
 * (action que dispara a geração), a rota de download do `.docx`, e a página
 * `/prep/[id]/ats` (decide se oferece o CTA de reescrita).
 */
export function decideCvRewriteAccess(input: CvRewriteAccessInput): CvRewriteAccessDecision {
  if (input === null) return { kind: "prep_not_found" };
  if (input.prepGuide === null || input.prepGuide === undefined) {
    return { kind: "prep_guide_missing" };
  }
  if (input.atsStatus !== "complete") {
    return { kind: "ats_not_complete" };
  }
  return { kind: "allowed" };
}

/** Atalho booleano para call sites que só precisam de sim/não. */
export function canGenerateCvRewrite(input: CvRewriteAccessInput): boolean {
  return decideCvRewriteAccess(input).kind === "allowed";
}
