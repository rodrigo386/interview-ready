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
  const promises = SECTION_KINDS.map((kind) => generateOne(kind, session, intel));
  const results = await Promise.allSettled(promises);

  const sections: PrepSection[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      sections.push(r.value);
    } else {
      errors.push(formatReason(r.reason));
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

function formatReason(reason: unknown): string {
  if (reason instanceof GeminiResponseError) {
    return `${reason.message}\n\nRAW RESPONSE:\n${reason.rawResponse}`;
  }
  if (reason instanceof Error) {
    return reason.stack ?? reason.message;
  }
  return String(reason);
}

function formatIntelError(err: unknown): string {
  if (err instanceof GeminiResponseError) {
    return `${err.message}\n\nRAW RESPONSE:\n${err.rawResponse}`;
  }
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  return String(err);
}
