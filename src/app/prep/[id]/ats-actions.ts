"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildAtsAnalyzerPrompt } from "@/lib/ai/prompts/ats-analyzer";
import { generateAtsAnalysis } from "@/lib/ai/anthropic";

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

  // Guard against concurrent clicks
  if (session.ats_status === "generating" || session.ats_status === "complete") {
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  await supabase
    .from("prep_sessions")
    .update({ ats_status: "generating", ats_error_message: null })
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
    const message = err instanceof Error ? err.message.slice(0, 1500) : "Unknown error";
    await supabase
      .from("prep_sessions")
      .update({ ats_status: "failed", ats_error_message: message })
      .eq("id", sessionId);
  }

  revalidatePath(`/prep/${sessionId}`);
}
