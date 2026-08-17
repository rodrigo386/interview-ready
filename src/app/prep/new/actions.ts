"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkQuota } from "@/lib/billing/quota";
import {
  consumePrepCredit,
  refundPrepCredit,
  creditPrepRefundUnconditional,
} from "@/lib/billing/consume";
import { classifyRetryRecovery } from "@/lib/prep/retry-gate";
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

  // Consumo atômico da cota — o RPC só tem GRANT pro service_role (migration
  // 0024), por isso vai pelo admin client. Precisa do id da sessão porque o
  // consumo agora MARCA `credit_consumed_at` NELA (raiz da idempotência da
  // devolução — ver comentário em `consumePrepCredit`), então o insert tem
  // que vir primeiro: não dá mais pra consumir antes de a sessão existir.
  //
  // Isso reabre o risco de linha órfã que a rodada anterior tinha fechado
  // consumindo antes de inserir — resolvido aqui apagando a linha se o
  // consumo falhar, em vez de mudar a ordem.
  const admin = createAdminClient();
  const consumed = await consumePrepCredit(admin, user.id, session.id, isAdmin);
  if (!consumed) {
    const { error: deleteError } = await supabase
      .from("prep_sessions")
      .delete()
      .eq("id", session.id)
      .eq("user_id", user.id);
    if (deleteError) {
      console.error(
        "[createPrep] delete da linha órfã falhou:",
        deleteError.message,
        deleteError.code,
      );
    }
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
  // IIFE + try/catch em vez de .then().catch(): os handlers chamam
  // createAdminClient(), que LANÇA se SUPABASE_SERVICE_ROLE_KEY faltar. Um
  // handler assíncrono que lança vira unhandled rejection — no Node isso
  // derruba o processo inteiro (todos os usuários, não só este request).
  //
  // O try/catch cobre SÓ o `runGeneration(sessionId)` em si — não a
  // releitura de status pós-geração. Cobrir os dois no mesmo catch foi um
  // bug da rodada anterior: uma exceção na releitura (depois de uma geração
  // BEM-SUCEDIDA) caía no catch de crash e devolvia o crédito de uma prep
  // que já tinha sido entregue — pessoa ficava com o prep E o crédito de
  // volta. Com o escopo estreito, o catch só dispara pra erro real do
  // pipeline (onde devolver é sempre correto); a releitura tem seu próprio
  // try/catch que NUNCA devolve em caso de erro (não dá pra saber se a
  // prep foi entregue ou não, e "devolver na dúvida" é o mesmo bug ao
  // contrário).
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
    } catch (err) {
      console.error(
        `[runGeneration] background CRASHED sessionId=${sessionId}`,
        err instanceof Error ? err.message : String(err),
      );
      // Crash real do pipeline (ou da import) — refund incondicional é
      // seguro aqui: só chegamos neste catch quando `runGeneration` NUNCA
      // terminou com sucesso.
      if (refundOnFailure) {
        try {
          await refundPrepCredit(
            createAdminClient(),
            refundOnFailure.userId,
            sessionId,
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
      return;
    }

    // A partir daqui `runGeneration` já terminou SEM lançar. runPipeline
    // (src/lib/ai/pipeline.ts) nunca lança — todo desfecho, inclusive
    // falha, é gravado como status terminal no banco. Por isso o único
    // jeito confiável de saber se esta geração falhou é reler o status.
    if (!refundOnFailure) return;
    try {
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
        await refundPrepCredit(admin, refundOnFailure.userId, sessionId, refundOnFailure.isAdmin);
      }
    } catch (err) {
      // Erro aqui é só na LEITURA pós-geração, não na geração em si (que já
      // terminou). Não devolve — devolver às cegas arriscaria dar crédito
      // de graça por uma prep que pode ter sido entregue.
      console.error(
        `[runGeneration] post-generation status check failed sessionId=${sessionId}`,
        err instanceof Error ? err.message : String(err),
      );
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
 * createPrep e generateFullPrep — MAS só quando o crédito da tentativa
 * anterior já voltou pro saldo. Ver `classifyRetryRecovery` em
 * `src/lib/prep/retry-gate.ts`: `generation_status === "failed"` significa
 * que `runGenerationInBackground` já devolveu; `pending`/`generating`
 * travado além do stale threshold significa que o processo que devolveria
 * morreu junto — o crédito continua gasto e sem volta, cobrar de novo
 * pagaria duas vezes pela mesma preparação que nunca chegou.
 *
 * Motivo original da mudança: com a devolução automática em falha, manter o
 * retry SEMPRE gratuito abria compensação dupla — falha devolve o crédito,
 * e "Tentar novamente" gerava de novo sem cobrar nada, repetível à vontade.
 * O modelo correto é "a pessoa paga uma vez por cada preparação que
 * efetivamente recebe": falhou (com devolução), tenta de novo, paga de
 * novo; travou (sem devolução), tenta de novo, não paga de novo — já pagou.
 *
 * `classifyRetryRecovery` reavalia staleness AQUI, no servidor, em vez de
 * confiar que "pending"/"generating" só chega até aqui já travado. Essa
 * premissa (do layout, que só mostra `PrepFailed` quando `isGenerationStale`
 * já deu true) quebra depois de um retry bem sucedido: a linha volta a
 * "pending" FRESCO, e uma segunda aba com o `PrepFailed` antigo ainda
 * montado chama `retryPrep` de novo — sem reavaliar, seria classificada
 * como zumbi e dispararia um SEGUNDO runner correndo em paralelo com o
 * primeiro, com `prep_guide` sendo apagado no meio da execução dele.
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
    .select("id, user_id, generation_status, error_message, prep_guide, updated_at, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");
  if (session.generation_status === "complete") redirect(`/prep/${id}`);

  const recovery = classifyRetryRecovery({
    generationStatus: session.generation_status,
    updatedAt: session.updated_at ?? session.created_at,
    now: Date.now(),
  });
  if (recovery.kind === "not_retryable") redirect(`/prep/${id}`);
  if (recovery.kind === "still_running") {
    // Geração genuinamente em andamento (recém-escrita, não passou do
    // threshold de stale) — resetar por baixo dela corromperia a escrita do
    // runner que já está rodando. Recusa e volta pra tela, que já sabe
    // renderizar o skeleton certo pra esse estado.
    redirect(`/prep/${id}`);
  }

  // Mesmo limite dos outros dois caminhos de geração — retry também chama o
  // mesmo pipeline caro.
  const rl = await rateLimit(`user:${user.id}`, LIMITS.createPrep);
  if (!rl.success) {
    return {
      error: `Muitas preps em pouco tempo. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
    };
  }

  // isAdmin é necessário nos dois ramos (cobrando ou não) — runGenerationInBackground
  // usa pra decidir se `refundPrepCredit` faz algo em caso de falha.
  const { data: billingProfile } = await supabase
    .from("profiles")
    .select("prep_credits, is_admin")
    .eq("id", user.id)
    .single();
  const p = billingProfile as { prep_credits?: number; is_admin?: boolean } | null;
  const isAdmin = p?.is_admin === true;

  const shouldCharge = recovery.kind === "failed_refunded";
  if (shouldCharge) {
    // Checagem ANTES de tocar a linha — igual createPrep/generateFullPrep:
    // sem saldo, sai sem efeito colateral nenhum.
    const quota = checkQuota({ prep_credits: p?.prep_credits ?? 0 }, isAdmin);
    if (!quota.allowed) {
      return { error: "quota_exceeded" };
    }
  }

  // Cadeado: o reset só afeta a linha se `generation_status` ainda for
  // exatamente o que acabamos de ler. Sem isso, dois submits do mesmo botão
  // (segunda aba, bfcache, voltar no histórico) resetavam a linha duas
  // vezes e cada um disparava um `runGenerationInBackground` — o segundo
  // `runPipeline` lia "generating" (escrito pelo primeiro) e virava no-op
  // sem gravar "failed" nem "complete", então a releitura de status do
  // primeiro runner não devolvia nada: crédito consumido, nada entregue,
  // sem devolução. Quem perde a corrida (0 linhas afetadas) só volta pra
  // tela — a regeração de quem ganhou já está em andamento.
  const { data: claimed, error: resetError } = await supabase
    .from("prep_sessions")
    .update({
      generation_status: "pending",
      error_message: null,
      prep_guide: null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("generation_status", session.generation_status)
    .select("id");

  if (resetError) {
    console.error("[retryPrep] reset failed:", resetError.message, resetError.code);
    return {
      error: "Não foi possível reiniciar sua prep agora. Tente novamente em alguns instantes.",
    };
  }
  if (!claimed || claimed.length === 0) {
    redirect(`/prep/${id}`);
  }

  if (shouldCharge) {
    const admin = createAdminClient();
    const consumed = await consumePrepCredit(admin, user.id, id, isAdmin);
    if (!consumed) {
      // Desfaz o cadeado: sem isso a sessão fica travada em "pending" com
      // `prep_guide` null — indistinguível de "gerando de verdade" até o
      // próximo timeout de stale, e a pessoa nem chegou a tentar de novo.
      // Condicionado ao "pending" que o cadeado acabou de gravar, e com o
      // erro checado — reverter às cegas foi exatamente o Minor D desta
      // mesma rodada de revisão (achado no `generateFullPrep`).
      const { error: revertError } = await supabase
        .from("prep_sessions")
        .update({
          generation_status: session.generation_status,
          error_message: session.error_message,
          prep_guide: session.prep_guide,
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("generation_status", "pending")
        .select("id");
      if (revertError) {
        console.error(
          "[retryPrep] revert do cadeado falhou:",
          revertError.message,
          revertError.code,
        );
      }
      return { error: "quota_exceeded" };
    }
  }

  void runGenerationInBackground(id, { userId: user.id, isAdmin });

  redirect(`/prep/${id}`);
}

export async function deleteFailedPrep(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("prep_sessions")
    .select("id, generation_status, updated_at, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!session) redirect("/prep/new");

  const recovery = classifyRetryRecovery({
    generationStatus: session.generation_status,
    updatedAt: session.updated_at ?? session.created_at,
    now: Date.now(),
  });
  if (recovery.kind === "still_running") {
    // Geração genuinamente em andamento — apagar por baixo do pipeline que
    // já está escrevendo nela corromperia a execução dele. Recusa, igual
    // retryPrep.
    redirect(`/prep/${id}`);
  }

  // O DELETE é o cadeado: condicionado ao `generation_status` que acabamos
  // de ler, e devolve as colunas de crédito da PRÓPRIA LINHA que apagou —
  // em vez de ler, decidir se devolve, e só então apagar (que deixava uma
  // janela entre a leitura e o apagamento pra outra ação mudar o estado por
  // baixo). Se outra aba/ação já mudou `generation_status` nesse meio-tempo
  // (outro clique em excluir, um retry concorrente), 0 linhas são afetadas
  // e não fazemos nada — não sabemos mais qual é o estado real, então não
  // arriscamos devolver.
  //
  // A decisão de devolver vem das colunas `credit_consumed_at`/
  // `credit_refunded_at` da linha exata que este DELETE apagou (RETURNING é
  // atômico — ninguém mais pode ter lido ou escrito essas colunas entre o
  // apagamento e a leitura do retorno). Como a sessão já não existe mais
  // depois do DELETE, a devolução aqui não pode passar por
  // `refund_prep_credit` (que precisa da linha pra checar idempotência) —
  // usa `creditPrepRefundUnconditional`, que credita direto, com o DELETE
  // condicional servindo de prova de que isso só acontece uma vez.
  const { data: deletedRows, error: deleteError } = await supabase
    .from("prep_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("generation_status", session.generation_status)
    .select("id, credit_consumed_at, credit_refunded_at");

  if (deleteError) {
    console.error("[deleteFailedPrep] delete failed:", deleteError.message, deleteError.code);
    redirect(`/prep/${id}`);
  }

  const deletedRow = deletedRows?.[0] as
    | { credit_consumed_at: string | null; credit_refunded_at: string | null }
    | undefined;

  if (deletedRow?.credit_consumed_at && !deletedRow.credit_refunded_at) {
    const { data: billingProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    const isAdmin = (billingProfile as { is_admin?: boolean } | null)?.is_admin === true;
    await creditPrepRefundUnconditional(createAdminClient(), user.id, isAdmin);
  }

  redirect("/prep/new");
}
