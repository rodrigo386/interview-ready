"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkQuota } from "@/lib/billing/quota";
import { consumePrepCredit, refundPrepCredit } from "@/lib/billing/consume";
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
    .select("prep_credits, is_admin")
    .eq("id", user.id)
    .single();

  const p = billingProfile as { prep_credits?: number; is_admin?: boolean } | null;
  const isAdmin = p?.is_admin === true;

  const quota = checkQuota({ prep_credits: p?.prep_credits ?? 0 }, isAdmin);
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

  // Consumo atômico da cota. O RPC só tem GRANT pro service_role (migration
  // 0024), por isso vai pelo admin client. A ordem é insert → consumir →
  // gerar: se o RPC falhar (sem saldo ou erro), barra aqui e NÃO dispara a
  // geração — liberar entregaria a preparação completa de graça.
  const admin = createAdminClient();
  const consumed = await consumePrepCredit(admin, user.id, isAdmin);
  if (!consumed) {
    return { error: "quota_exceeded" };
  }

  // Fire-and-forget the generation pipeline. Server actions on Railway run
  // inside the long-lived Node process — the promise survives after this
  // request returns. The /prep/[id] layout polls generation_status and
  // renders <PrepSkeleton /> until 'complete', so the UX is "redirect now,
  // skeleton then result" instead of "spinner blocked for 60s".
  //
  // Passa userId/isAdmin pra runGenerationInBackground devolver o crédito
  // se a geração falhar — ver comentário lá dentro sobre por que isso não
  // dá pra fazer só no .catch.
  void runGenerationInBackground(session.id, { userId: user.id, isAdmin });

  redirect(`/prep/${session.id}`);
}

function runGenerationInBackground(
  sessionId: string,
  /**
   * Presente só quando esta chamada consumiu 1 crédito (createPrep). Ausente
   * em retryPrep, que regenera algo já pago e não deve devolver nada.
   */
  refundOnFailure?: { userId: string; isAdmin: boolean },
): void {
  const t0 = Date.now();
  console.log(`[runGeneration] background start sessionId=${sessionId}`);
  // Dynamic import keeps generation.ts (and its Gemini deps) out of the
  // hot path's bundle graph; first-touch latency is acceptable here since
  // the user is already redirecting.
  import("./generation")
    .then(({ runGeneration }) => runGeneration(sessionId))
    .then(async () => {
      console.log(
        `[runGeneration] background done sessionId=${sessionId} ${Date.now() - t0}ms`,
      );
      if (!refundOnFailure) return;
      // runPipeline (src/lib/ai/pipeline.ts) NUNCA lança — todo desfecho,
      // inclusive falha, é gravado como status terminal no banco e a promise
      // resolve normalmente. Por isso o único jeito confiável de saber se
      // esta geração falhou é reler o status gravado, não confiar só no
      // .catch abaixo (que só pega crash que escapou do try/catch interno).
      const admin = createAdminClient();
      const { data } = await admin
        .from("prep_sessions")
        .select("generation_status")
        .eq("id", sessionId)
        .single();
      if (
        (data as { generation_status?: string } | null)?.generation_status ===
        "failed"
      ) {
        await refundPrepCredit(admin, refundOnFailure.userId, refundOnFailure.isAdmin);
      }
    })
    .catch(async (err) => {
      console.error(
        `[runGeneration] background CRASHED sessionId=${sessionId}`,
        err instanceof Error ? err.message : String(err),
      );
      // Crash que escapou do try/catch interno do pipeline — ainda é falha
      // de geração, e quem pagou não recebeu.
      if (refundOnFailure) {
        await refundPrepCredit(
          createAdminClient(),
          refundOnFailure.userId,
          refundOnFailure.isAdmin,
        );
      }
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
