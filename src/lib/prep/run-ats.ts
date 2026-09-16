import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAtsAnalyzerPrompt } from "@/lib/ai/prompts/ats-analyzer";
import { generateAtsAnalysis, generateJdKeywords, GeminiResponseError } from "@/lib/ai/gemini";
import { aplicarReguaFixa, obterRegua, type JdKeywords, type RulerDeps } from "@/lib/ai/ats-keywords";
import { findCachedJdKeywords, hashJd } from "@/lib/ai/jd-keywords-cache";
import type { AtsAnalysis } from "@/lib/ai/schemas";

export type RunAtsSessionData = {
  id: string;
  cv_text: string;
  job_description: string;
  job_title: string;
  company_name: string;
};

export type RunAtsDeps = {
  loadSession: (sessionId: string) => Promise<RunAtsSessionData | null>;
  analyze: (args: { system: string; user: string }) => Promise<AtsAnalysis>;
  updateSession: (
    sessionId: string,
    updates: Record<string, unknown>,
  ) => Promise<{ error: unknown }>;
  /**
   * Régua estável da vaga (ver `@/lib/ai/ats-keywords`). Opcional só pra que
   * testes antigos que injetam apenas `analyze` continuem valendo; em
   * produção vem sempre preenchida por `defaultDeps`.
   */
  ruler?: RulerDeps;
};

async function defaultLoadSession(sessionId: string): Promise<RunAtsSessionData | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("prep_sessions")
    .select("id, cv_text, job_description, job_title, company_name")
    .eq("id", sessionId)
    .single();
  if (error || !data) return null;
  return data as RunAtsSessionData;
}

async function defaultUpdateSession(
  sessionId: string,
  updates: Record<string, unknown>,
): Promise<{ error: unknown }> {
  const admin = createAdminClient();
  const { error } = await admin.from("prep_sessions").update(updates).eq("id", sessionId);
  return { error };
}

function defaultDeps(): RunAtsDeps {
  return {
    loadSession: defaultLoadSession,
    analyze: generateAtsAnalysis,
    updateSession: defaultUpdateSession,
    ruler: { findCached: findCachedJdKeywords, extract: generateJdKeywords },
  };
}

/**
 * Mensagem sempre em PT-BR, independente do erro original (que pode vir do
 * SDK do Gemini em inglês). O detalhe técnico vai anexado — é o que alimenta
 * `ErrorDetails` (tela ATS) e a lista de falhas do `/admin/health`.
 */
function formatAtsFailureMessage(err: unknown): string {
  const detail =
    err instanceof GeminiResponseError
      ? `${err.message}\n\nRAW RESPONSE:\n${err.rawResponse}`
      : err instanceof Error
        ? (err.stack ?? err.message)
        : String(err);
  return `Não foi possível concluir a análise ATS agora. Tente novamente em alguns instantes.\n\nDetalhe técnico: ${detail}`.slice(
    0,
    8000,
  );
}

/**
 * Miolo da análise ATS: marca "generating", roda a IA, grava "complete" com
 * a análise ou "failed" com uma mensagem em PT-BR. Compartilhado por
 * `createPrep` (dispara em background, sem ninguém pra tratar rejeição) e
 * por `runAtsAnalysis` (`ats-actions.ts`, que só adiciona auth + rate limit
 * por cima). Por isso NUNCA lança — todo o corpo está em try/catch.
 */
export async function runAtsForSession(
  sessionId: string,
  deps: RunAtsDeps = defaultDeps(),
): Promise<void> {
  try {
    const session = await deps.loadSession(sessionId);
    if (!session) return;

    await deps.updateSession(sessionId, {
      ats_status: "generating",
      ats_analysis: null,
      ats_error_message: null,
    });

    try {
      const regua = await reguaOuNada(session.job_description, deps.ruler);
      const { system, user } = buildAtsAnalyzerPrompt({
        cvText: session.cv_text,
        jdText: session.job_description,
        jobTitle: session.job_title,
        companyName: session.company_name,
        fixedKeywords: regua ?? undefined,
      });
      const bruta = await deps.analyze({ system, user });
      const analysis = regua
        ? {
            ...aplicarReguaFixa(bruta, regua, session.cv_text),
            jd_hash: hashJd(session.job_description),
          }
        : bruta;
      await deps.updateSession(sessionId, { ats_analysis: analysis, ats_status: "complete" });
    } catch (err) {
      console.error(`[runAtsForSession] falhou sessionId=${sessionId}`, err);
      await deps.updateSession(sessionId, {
        ats_status: "failed",
        ats_error_message: formatAtsFailureMessage(err),
      });
    }
  } catch (err) {
    // Erro fora do bloco de IA (ex.: loadSession/updateSession lançando —
    // createAdminClient() lança se faltar env var). Nunca deixa escapar:
    // quem chama em background não tem quem trate a rejeição.
    console.error(`[runAtsForSession] erro inesperado sessionId=${sessionId}`, err);
  }
}

/**
 * Régua da vaga, ou `null` se não der pra obter.
 *
 * Falhar a extração NÃO falha a análise: a ATS é o produto grátis e a porta
 * de entrada, e uma nota com régua instável ainda é melhor que nenhuma nota.
 * Cai no caminho antigo (extração e comparação na mesma chamada) e loga.
 */
export async function reguaOuNada(
  jdText: string,
  ruler: RulerDeps | undefined,
): Promise<JdKeywords | null> {
  if (!ruler) return null;
  try {
    return await obterRegua(jdText, ruler);
  } catch (err) {
    console.warn("[ats] extração da régua falhou; usando caminho de chamada única:", err);
    return null;
  }
}
