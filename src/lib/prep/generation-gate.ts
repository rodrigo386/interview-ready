export type GenerationGateInput = {
  generationStatus: "pending" | "generating" | "complete" | "failed" | null;
  prepGuide: unknown;
  atsStatus: string | null;
  /**
   * `company_intel_status`. A coluna nasce NULL (migration 0006 não define
   * DEFAULT) e o `runPipeline` a escreve como "researching" no seu PRIMEIRO
   * update, junto com `generation_status: "generating"` (a mesma UPDATE —
   * as duas colunas mudam atomicamente, nunca uma sem a outra). Ninguém
   * volta a gravar NULL: nem o `retryPrep`, nem o `rerunCompanyIntel`, nem o
   * próprio pipeline. É por isso que ela serve de marca durável de "esta
   * linha já teve um pipeline pago" — ver `hasNoPaidPipelineStarted`.
   */
  companyIntelStatus: string | null;
};

/**
 * Sinal de "nenhum pipeline PAGO (`runPipeline`/`generation.ts`) foi
 * disparado nesta sessão ainda" — nem a geração completa de uma prep normal,
 * nem um `retryPrep`, nem um `generateFullPrep`. Três colunas bastam, e
 * nenhuma delas é o ATS:
 *
 *  - `generation_status === "pending"`: todo pipeline pago, ao rodar, flipa
 *    isso pra "generating" na MESMA escrita que preenche
 *    `company_intel_status` (ver o comentário da coluna acima) — então
 *    "pending" sozinho nunca significa "pipeline rodando", só "não rodou
 *    ainda" ou "não roda mais".
 *  - `prep_guide === null`: `generateFullPrep` grava um placeholder NÃO
 *    nulo ANTES de disparar o pipeline (a claim/cadeado dele) — guide nulo
 *    descarta esse caminho também.
 *  - `company_intel_status === null`: a marca durável de "nunca teve
 *    pipeline pago", explicada no campo acima. `retryPrep` NÃO zera essa
 *    coluna, então uma prep normal em retry sempre chega aqui com ela
 *    preenchida (da geração anterior) — é o que separa "sem pipeline" de
 *    "com pipeline, regenerando".
 *
 * `ats_status` propositalmente NÃO entra aqui. Desde a Task 5
 * (`createPrep` passou a disparar só a análise ATS grátis, nunca mais o
 * pipeline pago), TODA prep nasce nesse estado — e o ATS pode estar em
 * qualquer um dos seus 4 estados (null, generating, complete, failed) sem
 * que isso diga nada sobre o pipeline pago, porque o pipeline pago nem
 * sabe que o ATS existe. Fazer o gate depender de `ats_status === "complete"`
 * (como era antes da Task 5, quando só a prep reivindicada do ATS anônimo
 * nascia neste estado) prendia QUALQUER falha ou demora da análise GRÁTIS
 * atrás do skeleton de página inteira e, 15 minutos depois, da tela
 * `PrepFailed` — a tela de falha da geração PAGA, com um botão que ou cobra
 * (`retryPrep` sem crédito) ou dispara o pipeline completo pago só pra
 * refazer uma análise grátis. Exatamente o paywall que esta prep ainda nem
 * decidiu se vai cruzar.
 */
export function hasNoPaidPipelineStarted(input: GenerationGateInput): boolean {
  return (
    input.generationStatus === "pending" &&
    input.prepGuide === null &&
    input.companyIntelStatus === null
  );
}

/**
 * Decide se uma prep deve ser tratada como "gerando de verdade" pelo gate do
 * layout (`/prep/[id]/layout.tsx`), que intercepta `{children}` com o
 * skeleton ou a tela de "travou" enquanto isso for `true`.
 *
 * `generation_status` pending/generating normalmente SIGNIFICA "gerando" —
 * mas uma prep sem pipeline pago disparado (ver `hasNoPaidPipelineStarted`)
 * nasce exatamente nesse estado de "pending" e nada roda em background pra
 * ela: gerar a preparação completa consome 1 crédito e tem que ser escolha
 * da pessoa, não algo automático. `ats_status` é irrelevante pra essa
 * decisão — ver o comentário de `hasNoPaidPipelineStarted`.
 */
export function isPrepGenerating(input: GenerationGateInput): boolean {
  const { generationStatus } = input;
  if (generationStatus !== "pending" && generationStatus !== "generating") return false;
  return !hasNoPaidPipelineStarted(input);
}

/**
 * Assinatura de uma prep sem pipeline pago cujo ATS já concluiu — o momento
 * exato em que faz sentido oferecer "Gerar preparação completa" (que cobra 1
 * crédito). Ao contrário de `isPrepGenerating`, esta função PRECISA exigir
 * `ats_status === "complete"`: o CTA pago só deve aparecer depois que a
 * pessoa já viu o resultado do ATS grátis, nunca antes (distrairia do valor
 * gratuito que a Task 5 existe pra entregar primeiro) nem durante uma falha
 * do ATS (que tem seu próprio retry grátis em `/prep/[id]/ats`).
 *
 * Usada só por `decideFullPrepGeneration` (`./full-prep.ts`) — o gate do
 * layout usa `hasNoPaidPipelineStarted` direto, sem a exigência de ATS
 * completo. As duas funções DIVERGEM de propósito desde a Task 5: o layout
 * só precisa saber "há pipeline pago rodando?" (resposta nunca depende do
 * ATS), enquanto o CTA precisa saber "o ATS já terminou?" também.
 */
export function isClaimedAtsOnlyPrep(input: GenerationGateInput): boolean {
  return hasNoPaidPipelineStarted(input) && input.atsStatus === "complete";
}
