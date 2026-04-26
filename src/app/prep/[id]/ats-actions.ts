"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildAtsAnalyzerPrompt } from "@/lib/ai/prompts/ats-analyzer";
import { generateAtsAnalysis, GeminiResponseError } from "@/lib/ai/gemini";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";

export async function runAtsAnalysis(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, user_id, cv_text, job_description, job_title, company_name, ats_status",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");

  // Guard against concurrent clicks only; allow re-run after complete/failed.
  if (session.ats_status === "generating") {
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  const rl = await rateLimit(`user:${user.id}`, LIMITS.ats);
  if (!rl.success) {
    await supabase
      .from("prep_sessions")
      .update({
        ats_status: "failed",
        ats_error_message: `Muitas análises ATS em pouco tempo. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
      })
      .eq("id", sessionId);
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  await supabase
    .from("prep_sessions")
    .update({
      ats_status: "generating",
      ats_analysis: null,
      ats_error_message: null,
    })
    .eq("id", sessionId);

  try {
    const { system, user: userMsg } = buildAtsAnalyzerPrompt({
      cvText: session.cv_text,
      jdText: session.job_description,
      jobTitle: session.job_title,
      companyName: session.company_name,
    });
    const analysis = await generateAtsAnalysis({ system, user: userMsg });
    await supabase
      .from("prep_sessions")
      .update({ ats_analysis: analysis, ats_status: "complete" })
      .eq("id", sessionId);
  } catch (err) {
    console.error(`[ats ${sessionId}] failed:`, err);
    const message = formatAtsError(err).slice(0, 8000);
    await supabase
      .from("prep_sessions")
      .update({ ats_status: "failed", ats_error_message: message })
      .eq("id", sessionId);
  }

  revalidatePath(`/prep/${sessionId}`);
}

function formatAtsError(err: unknown): string {
  if (err instanceof GeminiResponseError) {
    return `${err.message}\n\nRAW RESPONSE:\n${err.rawResponse}`;
  }
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  return String(err);
}
