"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCvRewritePrompt } from "@/lib/ai/prompts/cv-rewriter";
import { generateCvRewrite, GeminiResponseError } from "@/lib/ai/gemini";
import { atsAnalysisSchema } from "@/lib/ai/schemas";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";
import { decideCvRewriteAccess } from "@/lib/prep/cv-rewrite-gate";

export async function runCvRewrite(sessionId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, user_id, cv_text, job_description, job_title, company_name, ats_status, ats_analysis, cv_rewrite_status, prep_guide",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");

  // Gate de receita (Task 10): o CV reescrito é o entregável pago. Exige
  // `prep_guide` não nulo (preparação completa já gerada), não só ATS
  // completo — ver src/lib/prep/cv-rewrite-gate.ts.
  const access = decideCvRewriteAccess({
    prepGuide: session.prep_guide,
    atsStatus: session.ats_status,
  });
  if (access.kind !== "allowed") {
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  if (session.cv_rewrite_status === "generating") {
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  const rl = await rateLimit(`user:${user.id}`, LIMITS.cvRewrite);
  if (!rl.success) {
    await supabase
      .from("prep_sessions")
      .update({
        cv_rewrite_status: "failed",
        cv_rewrite_error: `Muitas reescritas de CV em pouco tempo. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
      })
      .eq("id", sessionId);
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  await supabase
    .from("prep_sessions")
    .update({
      cv_rewrite_status: "generating",
      cv_rewrite: null,
      cv_rewrite_error: null,
    })
    .eq("id", sessionId);

  try {
    const parsedAts = atsAnalysisSchema.safeParse(session.ats_analysis);
    if (!parsedAts.success) {
      throw new Error(`Stored ATS analysis is malformed: ${parsedAts.error.message}`);
    }

    const { system, user: userMsg } = buildCvRewritePrompt({
      cvText: session.cv_text,
      jobDescription: session.job_description,
      jobTitle: session.job_title,
      companyName: session.company_name,
      topFixes: parsedAts.data.top_fixes,
    });

    const rewrite = await generateCvRewrite({ system, user: userMsg });

    await supabase
      .from("prep_sessions")
      .update({
        cv_rewrite: rewrite,
        cv_rewrite_status: "complete",
      })
      .eq("id", sessionId);
  } catch (err) {
    console.error(`[cv-rewrite ${sessionId}] failed:`, err);
    const message = formatRewriteError(err).slice(0, 8000);
    await supabase
      .from("prep_sessions")
      .update({
        cv_rewrite_status: "failed",
        cv_rewrite_error: message,
      })
      .eq("id", sessionId);
  }

  revalidatePath(`/prep/${sessionId}`);
}

function formatRewriteError(err: unknown): string {
  if (err instanceof GeminiResponseError) {
    return `${err.message}\n\nRAW RESPONSE:\n${err.rawResponse}`;
  }
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  return String(err);
}
