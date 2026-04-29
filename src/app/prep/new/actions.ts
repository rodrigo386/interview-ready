"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkQuota, type ProfileBilling } from "@/lib/billing/quota";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";
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

  // Rate limit gate (per user, applied before quota so abusers don't burn DB queries).
  const rl = await rateLimit(`user:${user.id}`, LIMITS.createPrep);
  if (!rl.success) {
    return {
      error: `Muitas preps em pouco tempo. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
    };
  }

  // Quota gate.
  const { data: billingProfile } = await supabase
    .from("profiles")
    .select(
      "subscription_status, preps_used_this_month, preps_reset_at, prep_credits",
    )
    .eq("id", user.id)
    .single();

  const billing: ProfileBilling = {
    subscription_status: (billingProfile as { subscription_status?: ProfileBilling["subscription_status"] } | null)?.subscription_status ?? "none",
    preps_used_this_month: (billingProfile as { preps_used_this_month?: number } | null)?.preps_used_this_month ?? 0,
    preps_reset_at: (billingProfile as { preps_reset_at?: string } | null)?.preps_reset_at ?? new Date().toISOString(),
    prep_credits: (billingProfile as { prep_credits?: number } | null)?.prep_credits ?? 0,
  };
  const quota = checkQuota(billing, new Date());
  if (!quota.allowed) {
    return { error: "quota_exceeded" };
  }

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
      return { error: "CV não encontrado. Envie um arquivo ou cole o texto." };
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
    console.error("[createPrep] insert failed:", insertError?.message, insertError?.code);
    return { error: "Não foi possível salvar seu prep agora. Tente novamente em alguns instantes." };
  }

  // Quota consumption. These columns (prep_credits, preps_used_this_month)
  // are server-managed — `authenticated` has no UPDATE grant on them, so we
  // write via the admin client. We've already verified ownership via getUser
  // above and quota state via checkQuota, so privilege escalation isn't a
  // concern here.
  const admin = createAdminClient();
  if (quota.mode === "credit") {
    await admin
      .from("profiles")
      .update({ prep_credits: billing.prep_credits - 1 })
      .eq("id", user.id);
  } else {
    // pro or free: increment lifetime counter (free enforces 0→1 cap; pro is analytics).
    await admin
      .from("profiles")
      .update({ preps_used_this_month: billing.preps_used_this_month + 1 })
      .eq("id", user.id);
  }

  // Fire-and-forget the generation pipeline. Server actions on Railway run
  // inside the long-lived Node process — the promise survives after this
  // request returns. The /prep/[id] layout polls generation_status and
  // renders <PrepSkeleton /> until 'complete', so the UX is "redirect now,
  // skeleton then result" instead of "spinner blocked for 60s".
  //
  // Errors inside runGeneration mark the row as 'failed' in the DB; the
  // outer .catch is a last-resort net for crashes that escape that try/catch.
  void runGenerationInBackground(session.id);

  redirect(`/prep/${session.id}`);
}

function runGenerationInBackground(sessionId: string): void {
  const t0 = Date.now();
  console.log(`[runGeneration] background start sessionId=${sessionId}`);
  // Dynamic import keeps generation.ts (and its Gemini deps) out of the
  // hot path's bundle graph; first-touch latency is acceptable here since
  // the user is already redirecting.
  import("./generation")
    .then(({ runGeneration }) => runGeneration(sessionId))
    .then(() => {
      console.log(
        `[runGeneration] background done sessionId=${sessionId} ${Date.now() - t0}ms`,
      );
    })
    .catch((err) => {
      console.error(
        `[runGeneration] background CRASHED sessionId=${sessionId}`,
        err instanceof Error ? err.message : String(err),
      );
    });
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

  void runGenerationInBackground(id);

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
