import { createClient } from "@/lib/supabase/server";
import {
  generateSection,
  generateCompanyIntel,
  GeminiResponseError,
} from "@/lib/ai/gemini";
import { buildCompanyResearchPrompt } from "@/lib/ai/prompts/company-research";
import {
  buildSectionPrompt,
  SECTION_KINDS,
  type SectionKind,
} from "@/lib/ai/prompts/section-generator";
import type { CompanyIntel, PrepSection } from "@/lib/ai/schemas";

/**
 * Orchestrates the full prep generation pipeline:
 *   Stage A — Company research (optional, graceful degradation)
 *   Stage B — 5 parallel section calls enriched with intel
 *
 * Never throws — always writes a terminal status.
 */
export async function runPipeline(sessionId: string): Promise<void> {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, cv_text, job_description, job_title, company_name, generation_status",
    )
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    console.error(`[pipeline ${sessionId}] session not found`);
    return;
  }

  if (
    session.generation_status !== "pending" &&
    session.generation_status !== "failed"
  ) {
    return;
  }

  const meta = {
    role: session.job_title,
    company: session.company_name,
    estimated_prep_time_minutes: 30,
  };

  await supabase
    .from("prep_sessions")
    .update({
      generation_status: "generating",
      company_intel_status: "researching",
      error_message: null,
      company_intel: null,
      company_intel_error: null,
      prep_guide: { meta, sections: [] },
    })
    .eq("id", sessionId);

  // ---------------- Stage A: Company research ----------------
  const intel = await runStageA(sessionId, session, supabase);

  // ---------------- Stage B: 5 parallel sections ----------------
  await runStageB(sessionId, session, intel, meta, supabase);
}

async function runStageA(
  sessionId: string,
  session: {
    company_name: string;
    job_title: string;
  },
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CompanyIntel | null> {
  const prompt = buildCompanyResearchPrompt({
    companyName: session.company_name,
    jobTitle: session.job_title,
  });

  try {
    const intel = await generateCompanyIntel(prompt);
    if (intel) {
      await supabase
        .from("prep_sessions")
        .update({
          company_intel: intel,
          company_intel_status: "complete",
        })
        .eq("id", sessionId);
      return intel;
    }
    // Skipped (web_search unavailable, no submit, iteration cap)
    await supabase
      .from("prep_sessions")
      .update({ company_intel_status: "skipped" })
      .eq("id", sessionId);
    return null;
  } catch (err) {
    console.error(`[pipeline ${sessionId}] Stage A failed:`, err);
    const message = formatIntelError(err).slice(0, 8000);
    await supabase
      .from("prep_sessions")
      .update({
        company_intel_status: "failed",
        company_intel_error: message,
      })
      .eq("id", sessionId);
    return null;
  }
}

// Delay between sequential section calls. Spreads the request load across
// the Gemini free-tier ~15 RPM window, dramatically reducing the chance of
// hitting the project-level rate limit that triggers correlated 503s on
// the primary AND the fallback models.
const SECTION_INTER_DELAY_MS = 1500;

async function runStageB(
  sessionId: string,
  session: {
    cv_text: string;
    job_description: string;
    job_title: string;
    company_name: string;
  },
  intel: CompanyIntel | null,
  meta: { role: string; company: string; estimated_prep_time_minutes: number },
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  // Sequential (not parallel) to avoid burst rate limits on Gemini free tier.
  // Trade-off: prep takes ~2-3 min instead of ~30s, but reliability >> speed.
  // Falling within the "1 a 3 minutos" promise in the FAQ.
  const sections: PrepSection[] = [];
  const errors: string[] = [];
  for (let i = 0; i < SECTION_KINDS.length; i++) {
    const kind = SECTION_KINDS[i];
    if (i > 0) await new Promise((r) => setTimeout(r, SECTION_INTER_DELAY_MS));
    try {
      sections.push(await generateOne(kind, session, intel));
    } catch (err) {
      errors.push(formatReason(err));
    }
  }

  if (errors.length > 0) {
    console.error(
      `[pipeline ${sessionId}] Stage B: ${errors.length} sections failed`,
    );
    await supabase
      .from("prep_sessions")
      .update({
        generation_status: "failed",
        error_message: errors.join("\n\n---\n\n").slice(0, 8000),
      })
      .eq("id", sessionId);
    return;
  }

  await supabase
    .from("prep_sessions")
    .update({
      prep_guide: { meta, sections },
      generation_status: "complete",
      error_message: null,
    })
    .eq("id", sessionId);
}

async function generateOne(
  kind: SectionKind,
  session: {
    cv_text: string;
    job_description: string;
    job_title: string;
    company_name: string;
  },
  intel: CompanyIntel | null,
): Promise<PrepSection> {
  const { system, user } = buildSectionPrompt({
    kind,
    cvText: session.cv_text,
    jdText: session.job_description,
    jobTitle: session.job_title,
    companyName: session.company_name,
    companyIntel: intel,
  });
  return generateSection({ kind, system, user });
}

/**
 * Translate raw AI error messages into user-friendly PT-BR. Strips stack traces
 * (which leak internal file paths like /app/.next/server/chunks/...) and maps
 * common transient/known failure modes to actionable copy. The full original
 * error is still server-logged via console.error before reaching here.
 */
function userFriendlyAiError(rawMessage: string): string {
  // First line only — strips stack frames (each "at ..." is on its own line).
  const firstLine = rawMessage.split("\n")[0]?.trim() ?? rawMessage;

  if (/\b(503|UNAVAILABLE|high demand|temporarily unavailable)\b/i.test(firstLine)) {
    return 'O serviço de IA está sobrecarregado no momento. Aguarde alguns instantes e clique em "Tentar novamente".';
  }
  if (/\b(429|RESOURCE_EXHAUSTED|rate limit|quota)\b/i.test(firstLine)) {
    return "Limite temporário de requisições atingido. Aguarde alguns segundos e tente novamente.";
  }
  if (/\b(deadline|ECONNRESET|ETIMEDOUT|fetch failed|network)\b/i.test(firstLine)) {
    return "Falha de conexão com o serviço de IA. Verifique sua internet e tente novamente.";
  }
  if (/schema validation|safeParse|invalid.*response|non-JSON/i.test(firstLine)) {
    return "A IA produziu uma resposta inesperada desta vez. Geralmente é transitório — tente novamente.";
  }
  if (/GOOGLE_API_KEY|API key/i.test(firstLine)) {
    return "Erro de configuração do servidor. Já fomos notificados — tente novamente em alguns minutos.";
  }
  // Generic fallback: return the first line, capped, sem stack trace.
  return firstLine.slice(0, 300);
}

function formatReason(reason: unknown): string {
  if (reason instanceof GeminiResponseError) {
    // Friendly summary; raw response goes after delimiter for the <details> block.
    const friendly = userFriendlyAiError(reason.message);
    const rawCapped = reason.rawResponse.slice(0, 1000);
    return rawCapped
      ? `${friendly}\n\nRAW RESPONSE:\n${rawCapped}`
      : friendly;
  }
  if (reason instanceof Error) {
    return userFriendlyAiError(reason.message);
  }
  return userFriendlyAiError(String(reason));
}

function formatIntelError(err: unknown): string {
  if (err instanceof GeminiResponseError) {
    const friendly = userFriendlyAiError(err.message);
    const rawCapped = err.rawResponse.slice(0, 1000);
    return rawCapped
      ? `${friendly}\n\nRAW RESPONSE:\n${rawCapped}`
      : friendly;
  }
  if (err instanceof Error) {
    return userFriendlyAiError(err.message);
  }
  return userFriendlyAiError(String(err));
}
