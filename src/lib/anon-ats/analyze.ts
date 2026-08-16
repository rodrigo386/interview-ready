import "server-only";
import { buildAtsAnalyzerPrompt } from "@/lib/ai/prompts/ats-analyzer";
import { callCerebrasJson, type CerebrasResult } from "@/lib/ai/cerebras";
import { generateAtsAnalysis } from "@/lib/ai/gemini";
import { atsAnalysisSchema, type AtsAnalysis } from "@/lib/ai/schemas";
import type { NormalizedAnonInput } from "./core";

export type AnalyzeDeps = {
  callCerebras: (opts: {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxTokens: number;
    label: string;
  }) => Promise<CerebrasResult>;
  callGemini: (params: { system: string; user: string }) => Promise<AtsAnalysis>;
};

const DEFAULT_DEPS: AnalyzeDeps = {
  callCerebras: callCerebrasJson,
  callGemini: generateAtsAnalysis,
};

const ERRO_GENERICO =
  "Não conseguimos analisar agora. Tente de novo em alguns minutos.";

/**
 * Cerebras (free tier) primeiro; Gemini (pago) só quando o Cerebras falha ou
 * devolve algo fora do schema. O custo pago acontece na fração que falha e
 * continua limitado pelos tetos de IP e diário aplicados antes daqui.
 */
export async function analyzeAnonAts(
  input: NormalizedAnonInput,
  deps: AnalyzeDeps = DEFAULT_DEPS,
): Promise<
  | { ok: true; analysis: AtsAnalysis; modelUsed: "cerebras" | "gemini" }
  | { ok: false; error: string }
> {
  const { system, user } = buildAtsAnalyzerPrompt({
    cvText: input.cvText,
    jdText: input.jobDescription,
    jobTitle: input.jobTitle,
    companyName: input.companyName,
  });

  const cerebras = await deps.callCerebras({
    systemPrompt: system,
    userPrompt: user,
    temperature: 0,
    maxTokens: 16_000,
    label: "anon-ats",
  }).catch(() => ({ ok: false, reason: "all_failed" }) as CerebrasResult);

  if (cerebras.ok) {
    const parsed = safeParseAnalysis(cerebras.text);
    if (parsed) return { ok: true, analysis: parsed, modelUsed: "cerebras" };
    console.warn("[anon-ats] Cerebras fora do schema, caindo pro Gemini");
  }

  try {
    const analysis = await deps.callGemini({ system, user });
    return { ok: true, analysis, modelUsed: "gemini" };
  } catch (err) {
    console.warn("[anon-ats] Gemini também falhou:", err);
    return { ok: false, error: ERRO_GENERICO };
  }
}

/** Qwen às vezes embrulha o JSON em prosa ou cercas de markdown. */
function safeParseAnalysis(text: string): AtsAnalysis | null {
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1]);
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced) candidates.push(braced);

  for (const c of candidates) {
    try {
      const parsed = atsAnalysisSchema.safeParse(JSON.parse(c));
      if (parsed.success) return parsed.data;
    } catch {
      // tenta o próximo candidato
    }
  }
  return null;
}
