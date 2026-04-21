import { createClient } from "@/lib/supabase/server";
import { generateSection } from "@/lib/ai/anthropic";
import {
  buildSectionPrompt,
  SECTION_KINDS,
  type SectionKind,
} from "@/lib/ai/prompts/section-generator";
import type { PrepSection } from "@/lib/ai/schemas";

/**
 * Run the 3 parallel section generations for a prep_sessions row.
 * Never throws — always writes a terminal status.
 * Called by the Server Action (inline) AND the Route Handler (HTTP).
 */
export async function runGeneration(sessionId: string): Promise<void> {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, cv_text, job_description, job_title, company_name, generation_status",
    )
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    console.error(`[generate ${sessionId}] session not found`);
    return;
  }

  if (
    session.generation_status !== "pending" &&
    session.generation_status !== "failed"
  ) {
    // Already running or done — skip
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
      error_message: null,
      prep_guide: { meta, sections: [] },
    })
    .eq("id", sessionId);

  const promises = SECTION_KINDS.map((kind) =>
    generateOne(kind, session, supabase),
  );
  const results = await Promise.allSettled(promises);

  const sections: PrepSection[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      sections.push(r.value);
    } else {
      errors.push(
        r.reason instanceof Error ? r.reason.message : String(r.reason),
      );
    }
  }

  if (errors.length > 0) {
    console.error(`[generate ${sessionId}] ${errors.length} failed:`, errors);
    await supabase
      .from("prep_sessions")
      .update({
        generation_status: "failed",
        error_message: errors.join(" | ").slice(0, 1500),
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
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PrepSection> {
  const { system, user: userMsg } = buildSectionPrompt({
    kind,
    cvText: session.cv_text,
    jdText: session.job_description,
    jobTitle: session.job_title,
    companyName: session.company_name,
  });
  return await generateSection({ kind, system, user: userMsg });
}
