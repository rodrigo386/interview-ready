"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { buildPrepPrompt } from "@/lib/ai/prompts/prep-generator";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { createPrepGuide } from "@/lib/ai/anthropic";

const formSchema = z.object({
  jobTitle: z.string().min(2, "Job title is required").max(120),
  companyName: z.string().min(2, "Company name is required").max(120),
  cvText: z
    .string()
    .min(200, "Paste a longer CV — at least 200 characters"),
  jobDescription: z
    .string()
    .min(200, "Paste a longer job description — at least 200 characters"),
});

export type CreatePrepState = { error?: string };

type GenerationInput = {
  cvText: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
};

/**
 * Run the full generate → validate → persist pipeline for an existing
 * prep_sessions row. Sets status to complete/failed as appropriate.
 * Never throws — always writes a terminal status to the row.
 */
async function runGeneration(
  supabase: SupabaseClient,
  sessionId: string,
  input: GenerationInput,
): Promise<void> {
  try {
    const { system, user: userMsg } = buildPrepPrompt(input);
    const rawText = await createPrepGuide({ system, user: userMsg });

    // Slice on first `{` and last `}` to tolerate preamble/fences.
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    const jsonText =
      firstBrace >= 0 && lastBrace > firstBrace
        ? rawText.slice(firstBrace, lastBrace + 1)
        : rawText;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (parseErr) {
      const snippet = rawText.slice(0, 1000);
      console.error("[prep] JSON parse failed. Raw prefix:", snippet);
      throw new Error(
        `JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. Raw: ${snippet}`,
      );
    }

    const validated = prepGuideSchema.parse(parsedJson);

    await supabase
      .from("prep_sessions")
      .update({
        prep_guide: validated,
        generation_status: "complete",
        error_message: null,
      })
      .eq("id", sessionId);
  } catch (err) {
    console.error("[prep] generation failed:", err);
    const message =
      err instanceof Error ? err.message.slice(0, 1500) : "Unknown error";
    await supabase
      .from("prep_sessions")
      .update({
        generation_status: "failed",
        error_message: message,
      })
      .eq("id", sessionId);
  }
}

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
      generation_status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !session) {
    console.error("[createPrep] insert failed:", insertError);
    return {
      error: "Could not save your prep session. Please try again.",
    };
  }

  await runGeneration(supabase, session.id, {
    cvText: parsed.data.cvText,
    jdText: parsed.data.jobDescription,
    jobTitle: parsed.data.jobTitle,
    companyName: parsed.data.companyName,
  });

  redirect(`/prep/${session.id}`);
}

/**
 * Re-run generation for an existing failed session using the stored CV/JD.
 * User clicks "Retry" from the PrepFailed UI.
 */
export async function retryPrep(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, user_id, cv_text, job_description, job_title, company_name, generation_status",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");
  if (session.generation_status === "complete") redirect(`/prep/${id}`);

  await supabase
    .from("prep_sessions")
    .update({ generation_status: "generating", error_message: null })
    .eq("id", id);

  await runGeneration(supabase, id, {
    cvText: session.cv_text,
    jdText: session.job_description,
    jobTitle: session.job_title,
    companyName: session.company_name,
  });

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
