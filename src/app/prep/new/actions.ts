"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPrepInputSchema } from "./schema";

export type CreatePrepState = {
  error?: string;
  /** When set, indicates a duplicate prep already exists for this JD. */
  duplicate?: { id: string; companyName: string; jobTitle: string };
};

/** Stable fingerprint for "same JD" detection — lowercase, collapse whitespace. */
function jdFingerprint(jd: string): string {
  const normalized = jd.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

export async function createPrep(
  _prev: CreatePrepState,
  formData: FormData,
): Promise<CreatePrepState> {
  const parsed = createPrepInputSchema.safeParse({
    jobTitle: formData.get("jobTitle"),
    companyName: formData.get("companyName"),
    jobDescription: formData.get("jobDescription"),
    cvId: formData.get("cvId") || undefined,
    cvText: formData.get("cvText") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Você precisa estar logado pra criar um prep." };

  // Duplicate-JD check: same user + same JD fingerprint = same prep.
  // We hash all the user's existing JDs and compare; for typical users (<50
  // preps) this is fast enough without a DB index.
  const targetHash = jdFingerprint(parsed.data.jobDescription);
  const { data: existingPreps } = await supabase
    .from("prep_sessions")
    .select("id, company_name, job_title, job_description")
    .eq("user_id", user.id);

  if (existingPreps) {
    const dup = existingPreps.find(
      (p): p is { id: string; company_name: string; job_title: string; job_description: string } =>
        typeof p.job_description === "string" &&
        jdFingerprint(p.job_description) === targetHash,
    );
    if (dup) {
      return {
        duplicate: {
          id: dup.id,
          companyName: dup.company_name,
          jobTitle: dup.job_title,
        },
      };
    }
  }

  let cv_text: string;
  let cv_id: string | null = null;

  if (parsed.data.cvId) {
    const { data: cv, error: cvErr } = await supabase
      .from("cvs")
      .select("id, parsed_text")
      .eq("id", parsed.data.cvId)
      .eq("user_id", user.id)
      .single();
    if (cvErr || !cv) {
      return { error: "CV not found. Upload or paste one." };
    }
    cv_text = cv.parsed_text;
    cv_id = cv.id;
  } else {
    cv_text = parsed.data.cvText!;
  }

  const { data: session, error: insertError } = await supabase
    .from("prep_sessions")
    .insert({
      user_id: user.id,
      job_title: parsed.data.jobTitle,
      company_name: parsed.data.companyName,
      cv_text,
      cv_id,
      job_description: parsed.data.jobDescription,
      generation_status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !session) {
    console.error("[createPrep] insert failed:", insertError);
    return { error: "Could not save your prep session. Please try again." };
  }

  await runGenerationInline(session.id);
  redirect(`/prep/${session.id}`);
}

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
