import "server-only";
import { buildAtsAnalyzerPrompt } from "@/lib/ai/prompts/ats-analyzer";
import { generateAtsAnalysis } from "@/lib/ai/gemini";
import type { AtsAnalysis } from "@/lib/ai/schemas";
import type { NormalizedAnonInput } from "./core";

export type AnalyzeDeps = {
  callGemini: (params: { system: string; user: string }) => Promise<AtsAnalysis>;
};

const DEFAULT_DEPS: AnalyzeDeps = {
  callGemini: generateAtsAnalysis,
};

const ERRO_GENERICO =
  "Não conseguimos analisar agora. Tente de novo em alguns minutos.";

/**
 * A análise anônima roda só no Gemini. Até 2026-08-16 o Cerebras (free tier)
 * era chamado primeiro, com o Gemini pago como fallback — removido porque os
 * dois modelos que ele tentava (qwen-3-235b-a22b-instruct-2507 e
 * llama3.1-8b) sumiram do catálogo: produção mostrava HTTP 404 "Model does
 * not exist or you do not have access to it" para os dois. Deixamos de
 * consertar o catálogo pela terceira vez em quatro meses e removemos o elo.
 * `deps` continua injetável só para o teste rodar sem rede.
 */
export async function analyzeAnonAts(
  input: NormalizedAnonInput,
  deps: AnalyzeDeps = DEFAULT_DEPS,
): Promise<
  | { ok: true; analysis: AtsAnalysis }
  | { ok: false; error: string }
> {
  const { system, user } = buildAtsAnalyzerPrompt({
    cvText: input.cvText,
    jdText: input.jobDescription,
    jobTitle: input.jobTitle,
    companyName: input.companyName,
  });

  try {
    const analysis = await deps.callGemini({ system, user });
    return { ok: true, analysis };
  } catch (err) {
    console.warn("[anon-ats] Gemini falhou:", err);
    return { ok: false, error: ERRO_GENERICO };
  }
}
