"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const formSchema = z.object({
  jobTitle: z.string().min(2, "Job title is required").max(120),
  companyName: z.string().min(2, "Company name is required").max(120),
  cvText: z.string().min(200, "Paste a longer CV — at least 200 characters"),
  jobDescription: z
    .string()
    .min(200, "Paste a longer job description — at least 200 characters"),
});

export type CreatePrepState = { error?: string };

export async function createPrep(
  _prev: CreatePrepState,
  formData: FormData,
): Promise<CreatePrepState> {
  const parsed = formSchema.safeParse({
    jobTitle: formData.get("jobTitle"),
    companyName: formData.get("companyName"),
    cvText: formData.get("cvText"),
    jobDescription: formData.get("jobDescription"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to create a prep." };

  const { data: session, error: insertError } = await supabase
    .from("prep_sessions")
    .insert({
      user_id: user.id,
      job_title: parsed.data.jobTitle,
      company_name: parsed.data.companyName,
      cv_text: parsed.data.cvText,
      job_description: parsed.data.jobDescription,
      generation_status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !session) {
    console.error("[createPrep] insert failed:", insertError);
    return {
      error: "Could not save your prep session. Please try again.",
    };
  }

  // Run generation inline in the action. Railway has no serverless
  // timeout; the action will take ~20-40s with parallel tool calls.
  // This is simpler and more reliable than fire-and-forget fetch.
  await runGenerationInline(session.id);

  redirect(`/prep/${session.id}`);
}

/** Import-deferred to avoid circular types. Runs the same flow as the
 *  Route Handler's logic, invoked from the Server Action. */
async function runGenerationInline(sessionId: string) {
  const { runGeneration } = await import("./generation");
  await runGeneration(sessionId);
}

export async function retryPrep(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, user_id, generation_status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");
  if (session.generation_status === "complete") redirect(`/prep/${id}`);

  // Flip to pending so runGeneration's guard re-allows kickoff.
  await supabase
    .from("prep_sessions")
    .update({
      generation_status: "pending",
      error_message: null,
      prep_guide: null,
    })
    .eq("id", id);

  await runGenerationInline(id);

  redirect(`/prep/${id}`);
}

export async function deleteFailedPrep(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("prep_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  redirect("/prep/new");
}
