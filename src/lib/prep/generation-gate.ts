export type GenerationGateInput = {
  generationStatus: "pending" | "generating" | "complete" | "failed" | null;
  prepGuide: unknown;
  atsStatus: string | null;
  /**
   * `company_intel_status`. A coluna nasce NULL (migration 0006 não define
   * DEFAULT) e o `runPipeline` a escreve como "researching" no seu PRIMEIRO
   * update, junto com `generation_status: "generating"`. Ninguém volta a
   * gravar NULL: nem o `retryPrep`, nem o `rerunCompanyIntel`, nem o próprio
   * pipeline. É por isso que ela serve de marca durável de "esta linha já
   * teve um pipeline" — ver `isClaimedAtsOnlyPrep`.
   */
  companyIntelStatus: string | null;
};

/**
 * Decide se uma prep deve ser tratada como "gerando de verdade" pelo gate do
 * layout (`/prep/[id]/layout.tsx`), que intercepta `{children}` com o
 * skeleton ou a tela de "travou" enquanto isso for `true`.
 *
 * `generation_status` pending/generating normalmente SIGNIFICA "gerando" —
 * mas uma prep reivindicada da ferramenta ATS anônima (`claimAnonAnalysis` /
 * `anonAnalysisToPrepSession` em `src/lib/anon-ats/`) nasce exatamente nesse
 * estado: `generation_status: "pending"`, `prep_guide: null`, e
 * `ats_status: "complete"` (o ATS já veio pronto da análise anônima). Nada
 * dispara o pipeline de geração automaticamente pra essa prep — gerar a
 * preparação completa consome a cota grátis vitalícia da pessoa e tem que
 * ser escolha dela, não algo que acontece sozinho no cadastro.
 *
 * Sem essa distinção, o gate prendia essas preps num skeleton "Gerando seu
 * dossiê" que nunca avançava (nada roda em background pra elas) e, depois
 * de `STALE_GENERATION_MS`, numa mensagem de erro falsa ("a geração
 * travou — instabilidade do serviço de IA") quando na verdade nada tinha
 * rodado — a pessoa que acabou de criar conta pra ver a nota ATS que já
 * tinha ficava sem conseguir vê-la.
 */
export function isPrepGenerating(input: GenerationGateInput): boolean {
  const { generationStatus } = input;
  if (generationStatus !== "pending" && generationStatus !== "generating") return false;
  return !isClaimedAtsOnlyPrep(input);
}

/**
 * Assinatura exata de uma prep vinda da ferramenta ATS anônima que ainda só
 * tem a etapa 2: `generation_status: "pending"` (nada roda em background pra
 * ela), `prep_guide: null`, `ats_status: "complete"` e — o ponto decisivo —
 * `company_intel_status: null`.
 *
 * O `companyIntelStatus` está aqui porque as três primeiras condições sozinhas
 * NÃO separam a prep reivindicada de uma prep normal em retry:
 * `retryPrep` (`app/prep/new/actions.ts`) grava exatamente
 * `generation_status: "pending"` + `prep_guide: null`, e numa prep em que o
 * usuário já rodou o ATS o `ats_status` também é "complete". O efeito era
 * grave nos dois sentidos: o skeleton sumia durante uma regeração legítima e,
 * pior, aparecia o CTA "Gerar preparação completa" — que COBRA — para quem já
 * tinha pago por aquela prep e só estava tentando de novo. Se o job de retry
 * morresse antes da primeira escrita do pipeline, o convite a pagar de novo
 * ficava permanente.
 *
 * `company_intel_status` resolve isso sem depender de timing: a prep
 * reivindicada é inserida por `anonAnalysisToPrepSession` sem essa coluna
 * (fica NULL) e nunca teve pipeline; qualquer prep que já rodou tem a coluna
 * preenchida desde o primeiro update do `runPipeline`, e nada a devolve pra
 * NULL. "Já teve pipeline" é exatamente a pergunta que precisa ser respondida.
 *
 * Usado em dois lugares que precisam concordar: o gate do layout (não é
 * "gerando", é "esperando a pessoa decidir") e a oferta de gerar a preparação
 * completa (`decideFullPrepGeneration` em `./full-prep`, mais o CTA na tela
 * de ATS e no `StepNotGenerated`). Duplicar a condição faria os dois
 * divergirem no primeiro ajuste.
 */
export function isClaimedAtsOnlyPrep(input: GenerationGateInput): boolean {
  return (
    input.generationStatus === "pending" &&
    input.prepGuide === null &&
    input.atsStatus === "complete" &&
    input.companyIntelStatus === null
  );
}
