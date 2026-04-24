"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCvRewritePrompt } from "@/lib/ai/prompts/cv-rewriter";
import { generateCvRewrite, GeminiResponseError } from "@/lib/ai/gemini";
import { atsAnalysisSchema } from "@/lib/ai/schemas";

export async function runCvRewrite(sessionId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, user_id, cv_text, job_description, job_title, company_name, ats_status, ats_analysis, cv_rewrite_status",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");

  if (session.ats_status !== "complete") {
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  if (session.cv_rewrite_status === "generating") {
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
