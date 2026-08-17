import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAtsAnalyzerPrompt } from "@/lib/ai/prompts/ats-analyzer";
import { generateAtsAnalysis, GeminiResponseError } from "@/lib/ai/gemini";
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
      const { system, user } = buildAtsAnalyzerPrompt({
        cvText: session.cv_text,
        jdText: session.job_description,
        jobTitle: session.job_title,
        companyName: session.company_name,
      });
      const analysis = await deps.analyze({ system, user });
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
