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

  // Consumo atômico da cota ANTES do insert. O RPC só tem GRANT pro
  // service_role (migration 0024), por isso vai pelo admin client.
  //
  // A ordem inverte o padrão do full-prep-actions.ts (lá é claim → consumir,
  // porque a claim É o lock contra duplo clique) — aqui não existe lock
  // prévio nenhum, então consumir antes de inserir é estritamente mais
  // simples: se o RPC falhar (sem saldo ou erro), a pessoa nunca vê nada
  // criado, sem linha `prep_sessions` órfã presa em "pending" pra sempre
  // bloqueando a detecção de duplicata da mesma vaga (achado da rodada de
  // revisão anterior — inserir antes de consumir criava exatamente essa
  // linha travada).
  const admin = createAdminClient();
  const consumed = await consumePrepCredit(admin, user.id, isAdmin);
  if (!consumed) {
    return { error: "quota_exceeded" };
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
    // Já consumimos o crédito acima — sem devolver aqui, um erro de insert
    // (raro, mas possível) cobraria por uma prep que nunca chegou a existir.
    await refundPrepCredit(admin, user.id, isAdmin);
    return { error: "Não foi possível salvar seu prep agora. Tente novamente em alguns instantes." };
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
   * `{ userId, isAdmin }` de quem pagou por esta geração — createPrep e
   * retryPrep passam os dois agora (retryPrep passou a consumir crédito
   * nesta rodada de correção; regenerar de graça depois de já ter devolvido
   * o crédito da falha anterior pagava duas vezes o mesmo erro). Opcional
   * só por cautela de call sites futuros que não consumam nada.
   */
  refundOnFailure?: { userId: string; isAdmin: boolean },
): void {
  const t0 = Date.now();
  console.log(`[runGeneration] background start sessionId=${sessionId}`);
  // IIFE + try/catch em vez do antigo .then().catch(): os handlers chamam
  // createAdminClient(), que LANÇA se SUPABASE_SERVICE_ROLE_KEY faltar. Um
  // handler assíncrono de .catch() que lança vira unhandled rejection — no
  // Node isso derruba o processo inteiro (todos os usuários, não só este
  // request). O try/catch aqui garante que nada escapa desta função, nem o
  // do bloco catch (que tem seu próprio try/catch pra a tentativa de
  // devolução em si não poder relançar).
  void (async () => {
    try {
      // Dynamic import keeps generation.ts (and its Gemini deps) out of the
      // hot path's bundle graph; first-touch latency is acceptable here
      // since the user is already redirecting.
      const { runGeneration } = await import("./generation");
      await runGeneration(sessionId);
      console.log(
        `[runGeneration] background done sessionId=${sessionId} ${Date.now() - t0}ms`,
      );
      if (!refundOnFailure) return;
      // runPipeline (src/lib/ai/pipeline.ts) NUNCA lança — todo desfecho,
      // inclusive falha, é gravado como status terminal no banco e a promise
      // resolve normalmente. Por isso o único jeito confiável de saber se
      // esta geração falhou é reler o status gravado, não confiar só no
      // catch abaixo (que só pega crash que escapou do try/catch interno).
      const admin = createAdminClient();
      const { data, error: statusReadError } = await admin
        .from("prep_sessions")
        .select("generation_status")
        .eq("id", sessionId)
        .single();
      if (statusReadError) {
        // Leitura falhou — não sabemos se falhou de verdade, e "devolver na
        // dúvida" pode dar crédito de graça pra uma prep que na verdade deu
        // certo. Loga pra não ficar silencioso; sem devolução automática.
        console.warn(
          `[runGeneration] status read failed sessionId=${sessionId}: ${statusReadError.message}`,
        );
        return;
      }
      if (
        (data as { generation_status?: string } | null)?.generation_status ===
        "failed"
      ) {
        await refundPrepCredit(admin, refundOnFailure.userId, refundOnFailure.isAdmin);
      }
    } catch (err) {
      console.error(
        `[runGeneration] background CRASHED sessionId=${sessionId}`,
        err instanceof Error ? err.message : String(err),
      );
      // Crash que escapou do try/catch interno do pipeline — ainda é falha
      // de geração, e quem pagou não recebeu.
      if (!refundOnFailure) return;
      try {
        await refundPrepCredit(
          createAdminClient(),
          refundOnFailure.userId,
          refundOnFailure.isAdmin,
        );
      } catch (refundErr) {
        // createAdminClient() pode lançar (env var faltando) — não deixa
        // escapar daqui, senão a promise da IIFE rejeita sem ninguém
        // observando e derruba o processo de novo.
        console.error(
          `[runGeneration] refund itself failed sessionId=${sessionId}`,
          refundErr instanceof Error ? refundErr.message : String(refundErr),
        );
      }
    }
  })();
}

export type RetryPrepState = {
  /** "quota_exceeded" é sentinela de UI, não texto. */
  error?: string;
};

/**
 * DECISÃO DO DONO DO PRODUTO (revoga a decisão original desta task, que
 * dizia "retryPrep não consome cota"): retry agora consome 1 crédito, igual
 * createPrep e generateFullPrep.
 *
 * Motivo: com a devolução automática em falha (`refundPrepCredit`, ligada em
 * `runGenerationInBackground`), manter o retry gratuito abria compensação
 * dupla — falha devolve o crédito, e o botão "Tentar novamente" gerava a
 * preparação de novo sem cobrar nada, repetível à vontade. O modelo correto
 * é "a pessoa paga uma vez por cada preparação que efetivamente recebe":
 * falhou, devolve; tenta de novo, paga de novo; se der certo dessa vez,
 * recebeu o que pagou.
 */
export async function retryPrep(
  id: string,
  _prev: RetryPrepState,
  _formData: FormData,
): Promise<RetryPrepState> {
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

  // Mesmo gate de createPrep/generateFullPrep.
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

  const admin = createAdminClient();
  const consumed = await consumePrepCredit(admin, user.id, isAdmin);
  if (!consumed) {
    return { error: "quota_exceeded" };
  }

  await supabase
    .from("prep_sessions")
    .update({
      generation_status: "pending",
      error_message: null,
      prep_guide: null,
    })
    .eq("id", id);

  void runGenerationInBackground(id, { userId: user.id, isAdmin });

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
