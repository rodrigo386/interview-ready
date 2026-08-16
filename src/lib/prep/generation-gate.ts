export type GenerationGateInput = {
  generationStatus: "pending" | "generating" | "complete" | "failed" | null;
  prepGuide: unknown;
  atsStatus: string | null;
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
  const { generationStatus, prepGuide, atsStatus } = input;
  if (generationStatus !== "pending" && generationStatus !== "generating") return false;

  const isClaimedWithoutPipeline =
    generationStatus === "pending" && prepGuide === null && atsStatus === "complete";
  return !isClaimedWithoutPipeline;
}
