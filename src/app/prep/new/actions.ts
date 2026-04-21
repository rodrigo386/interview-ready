"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
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

  try {
    const { system, user: userMsg } = buildPrepPrompt({
      cvText: parsed.data.cvText,
      jdText: parsed.data.jobDescription,
      jobTitle: parsed.data.jobTitle,
      companyName: parsed.data.companyName,
    });

    const rawText = await createPrepGuide({ system, user: userMsg });

    // Extract the JSON object from the response. Even with instructions,
    // models sometimes add preamble, fences, or trailing text. Slice on
    // first `{` and last `}` rather than trusting the whole string.
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
      // Save raw response snippet so we can diagnose in prod
      const snippet = rawText.slice(0, 1000);
      console.error("[createPrep] JSON parse failed. Raw prefix:", snippet);
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
      })
      .eq("id", session.id);
  } catch (err) {
    console.error("[createPrep] generation failed:", err);
    const message =
      err instanceof Error ? err.message.slice(0, 1500) : "Unknown error";
    await supabase
      .from("prep_sessions")
      .update({
        generation_status: "failed",
        error_message: message,
      })
      .eq("id", session.id);
  }

  redirect(`/prep/${session.id}`);
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
