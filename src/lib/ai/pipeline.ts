import { createClient } from "@/lib/supabase/server";
import {
  generateSection,
  generateCompanyIntel,
  generateSalaryBenchmark,
  GeminiResponseError,
} from "@/lib/ai/gemini";
import { buildCompanyResearchPrompt } from "@/lib/ai/prompts/company-research";
import { buildSalaryBenchmarkPrompt } from "@/lib/ai/prompts/salary-benchmark";
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
      progress_step: "company_research",
    })
    .eq("id", sessionId);

  // ---------------- Stage A: Company research ----------------
  const intel = await runStageA(sessionId, session, supabase);

  // ---------------- Stage Salary: Salary benchmark ----------------
  // Independent of Stage A — uses job_description directly, not intel.
  // Runs sequentially after A to avoid hammering the Gemini quota; ~3s
  // extra in the pipeline. Failure is graceful (writes 'failed' status,
  // user retries from the UI).
  await runStageSalary(sessionId, session, supabase);

  // ---------------- Stage B: 5 sequential sections ----------------
  await runStageB(sessionId, session, intel, meta, supabase);
}

/**
 * Update the progress_step column. Used by the skeleton UI to render
 * "Gerando 3/5: …" instead of a generic spinner. Errors are tolerated —
 * progress display is cosmetic; pipeline never fails because of it.
 */
async function setProgress(
  sessionId: string,
  step: string | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  try {
    await supabase
      .from("prep_sessions")
      .update({ progress_step: step })
      .eq("id", sessionId);
  } catch (err) {
    console.warn(`[pipeline ${sessionId}] setProgress failed:`, err);
  }
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

/**
 * Stage Salary: Brazilian salary benchmark for the role.
 * Mirrors runStageA shape exactly — graceful degradation, writes status,
 * never throws. Independent of Stage A intel; uses job_description directly
 * to infer seniority + region.
 */
async function runStageSalary(
  sessionId: string,
  session: {
    company_name: string;
    job_title: string;
    job_description: string;
  },
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  await setProgress(sessionId, "salary_benchmark", supabase);
  await supabase
    .from("prep_sessions")
    .update({ salary_benchmark_status: "researching" })
    .eq("id", sessionId);

  const prompt = buildSalaryBenchmarkPrompt({
    companyName: session.company_name,
    jobTitle: session.job_title,
    jobDescription: session.job_description,
  });

  try {
    const benchmark = await generateSalaryBenchmark(prompt);
    if (benchmark) {
      await supabase
        .from("prep_sessions")
        .update({
          salary_benchmark: benchmark,
          salary_benchmark_status: "complete",
        })
        .eq("id", sessionId);
      return;
    }
    await supabase
      .from("prep_sessions")
      .update({ salary_benchmark_status: "skipped" })
      .eq("id", sessionId);
  } catch (err) {
    console.error(`[pipeline ${sessionId}] Stage Salary failed:`, err);
    const message = formatIntelError(err).slice(0, 8000);
    await supabase
      .from("prep_sessions")
      .update({
        salary_benchmark_status: "failed",
        salary_benchmark_error: message,
      })
      .eq("id", sessionId);
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
  // Sequential (not parallel) to avoid burst rate limits on Gemini.
  // Trade-off: prep takes ~2-3 min instead of ~30s, but reliability >> speed.
  // Falling within the "1 a 3 minutos" promise in the FAQ.
  const sections: PrepSection[] = [];
  const errors: string[] = [];
  const failedKinds: SectionKind[] = [];
  for (let i = 0; i < SECTION_KINDS.length; i++) {
    const kind = SECTION_KINDS[i];
    if (i > 0) await new Promise((r) => setTimeout(r, SECTION_INTER_DELAY_MS));
    await setProgress(sessionId, kind, supabase);
    try {
      sections.push(await generateOne(kind, session, intel));
    } catch (err) {
      errors.push(`[${kind}] ${formatReason(err)}`);
      failedKinds.push(kind);
    }
  }

  // Partial-success policy: if at least MIN_SECTIONS_TO_SHIP succeed, ship
  // the prep with a "partial" flag so the UI can show a banner + offer
  // regeneration of failed sections. Anything below that threshold is too
  // sparse to be useful — fail entirely.
  const MIN_SECTIONS_TO_SHIP = 3;
  if (sections.length < MIN_SECTIONS_TO_SHIP) {
    console.error(
      `[pipeline ${sessionId}] Stage B: only ${sections.length}/${SECTION_KINDS.length} sections succeeded — failing prep`,
    );
    await supabase
      .from("prep_sessions")
      .update({
        generation_status: "failed",
        error_message: errors.join("\n\n---\n\n").slice(0, 8000),
        progress_step: null,
      })
      .eq("id", sessionId);
    return;
  }

  const isPartial = errors.length > 0;
  if (isPartial) {
    console.warn(
      `[pipeline ${sessionId}] Stage B: shipping partial — ${sections.length}/${SECTION_KINDS.length} sections OK, failed: ${failedKinds.join(", ")}`,
    );
  }

  const finalMeta = isPartial
    ? { ...meta, partial: true, failed_sections: failedKinds }
    : meta;

  await supabase
    .from("prep_sessions")
    .update({
      prep_guide: { meta: finalMeta, sections },
      generation_status: "complete",
      // Save errors for partial preps so /admin/health can audit which
      // sections failed and why. Cleared only on full success.
      error_message: isPartial
        ? errors.join("\n\n---\n\n").slice(0, 8000)
        : null,
      progress_step: null,
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
  if (/truncated|max_output_tokens|hit max/i.test(firstLine)) {
    return "A resposta da IA foi maior do que o esperado e ficou truncada. Tente novamente — a próxima geração geralmente cabe.";
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
