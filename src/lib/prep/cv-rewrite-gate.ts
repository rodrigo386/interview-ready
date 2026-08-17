export type CvRewriteGenerationInput = {
  prepGuide: unknown;
  atsStatus: string | null;
} | null;

export type CvRewriteGenerationDecision =
  | { kind: "allowed" }
  | { kind: "prep_not_found" }
  | { kind: "prep_guide_missing" }
  | { kind: "ats_not_complete" };

export type CvRewriteDownloadInput = {
  prepGuide: unknown;
  cvRewriteStatus: string | null;
} | null;

export type CvRewriteDownloadDecision =
  | { kind: "allowed" }
  | { kind: "prep_not_found" }
  | { kind: "prep_guide_missing" }
  | { kind: "rewrite_not_ready" };

/**
 * Task 10 (fechamento do vazamento de receita da Task 8): decide se o CV
 * reescrito pode ser GERADO para uma prep.
 *
 * O gate é `prep_guide` não nulo, não `ats_status === "complete"` sozinho.
 * Desde que a análise ATS virou grátis, exigir só `ats_status === "complete"`
 * deixava qualquer usuário logado gerar o CV reescrito — o entregável vendido
 * nos R$10 — sem pagar nada. `prep_guide` só existe numa prep cuja preparação
 * completa já foi gerada (pago via crédito avulso, Pro, ou o free grátis
 * vitalício), então é a marca de "já tem direito ao CV reescrito incluso".
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
 * IMPORTANTE (rodada de correção 1): esta função é só para GERAR. Ver
 * `decideCvRewriteDownload` para a decisão de BAIXAR — são deliberadamente
 * duas funções, não uma reaproveitada, porque as duas dependem de coisas
 * diferentes. Usada por `runCvRewrite` (`rewrite-actions.ts`, dispara a
 * geração) e pela página `/prep/[id]/ats` (decide se oferece o CTA).
 */
export function decideCvRewriteGeneration(
  input: CvRewriteGenerationInput,
): CvRewriteGenerationDecision {
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
export function canGenerateCvRewrite(input: CvRewriteGenerationInput): boolean {
  return decideCvRewriteGeneration(input).kind === "allowed";
}

/**
 * Decide se o CV reescrito pode ser BAIXADO (rota `cv-rewrite.docx`).
 *
 * Rodada de correção 1: a especificação original mandou aplicar "o MESMO
 * gate" da geração na rota de download — errado. Gerar depende do ATS porque
 * o prompt usa `top_fixes` da análise; baixar um arquivo que JÁ existe não
 * depende disso. O botão "↻ Rerodar análise" (mesma tela, acima do "Baixar
 * .docx") grava `ats_status: "generating"` na hora e `"failed"` se a IA
 * falhar, sem tocar `cv_rewrite_status` — exigir ATS completo pra baixar
 * devolvia 404 pra um arquivo que continuava existindo, quebrando o acesso
 * de quem já pagou.
 *
 * Baixar exige só:
 *  - `prep_guide` não nulo — mesma marca de "pagou a preparação completa" da
 *    geração; sem isso, uma prep legada com `cv_rewrite_status: "complete"`
 *    (reescrita gerada antes deste gate existir) continuaria baixável por
 *    URL direta mesmo sem `prep_guide` — a brecha que esta task fecha.
 *  - `cv_rewrite_status === "complete"` — o artefato de fato existe.
 *
 * `ats_status` NÃO entra aqui de propósito — nem está no tipo de entrada.
 */
export function decideCvRewriteDownload(
  input: CvRewriteDownloadInput,
): CvRewriteDownloadDecision {
  if (input === null) return { kind: "prep_not_found" };
  if (input.prepGuide === null || input.prepGuide === undefined) {
    return { kind: "prep_guide_missing" };
  }
  if (input.cvRewriteStatus !== "complete") {
    return { kind: "rewrite_not_ready" };
  }
  return { kind: "allowed" };
}

/** Atalho booleano para call sites que só precisam de sim/não. */
export function canDownloadCvRewrite(input: CvRewriteDownloadInput): boolean {
  return decideCvRewriteDownload(input).kind === "allowed";
}
