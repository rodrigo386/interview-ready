"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkQuota,
  isNewBillingCycle,
  type ProfileBilling,
} from "@/lib/billing/quota";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";
import { decideFullPrepGeneration } from "@/lib/prep/full-prep";

export type GenerateFullPrepState = {
  /** "quota_exceeded" e "pro_soft_cap" são sentinelas de UI, não texto. */
  error?: string;
};

/**
 * Gera a preparação completa (5 seções + pesquisa da empresa + benchmark
 * salarial) a partir de uma prep que já existe mas ainda não tem `prep_guide`
 * — na prática, a prep reivindicada da ferramenta ATS anônima.
 *
 * COTA: a spec diz que a análise reivindicada NÃO consome a preparação grátis
 * vitalícia, mas gerar a preparação completa CONSOME ("o presente não pode
 * virar pegadinha"). Por isso esta action replica o gate do `createPrep`
 * (`checkQuota` + consumo por modo) em vez de reaproveitar o `retryPrep`, que
 * é um caminho de recuperação de falha e de propósito não cobra nada — ligar o
 * CTA nele entregaria a preparação completa de graça.
 */
export async function generateFullPrep(
  sessionId: string,
  _prev: GenerateFullPrepState,
  _formData: FormData,
): Promise<GenerateFullPrepState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, generation_status, prep_guide, ats_status, company_intel_status, job_title, company_name",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");

  const decision = decideFullPrepGeneration({
    generationStatus: session.generation_status,
    prepGuide: session.prep_guide,
    atsStatus: session.ats_status,
    companyIntelStatus: session.company_intel_status,
  });
  // Todos os desfechos que não geram levam de volta pra prep: o layout já
  // sabe renderizar o estado certo (guia pronto, skeleton ou PrepFailed).
  if (decision.kind !== "generate") redirect(`/prep/${sessionId}`);

  // Mesmo limite do createPrep — é literalmente a mesma chamada de pipeline.
  const rl = await rateLimit(`user:${user.id}`, LIMITS.createPrep);
  if (!rl.success) {
    return {
      error: `Muitas preps em pouco tempo. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
    };
  }

  const { data: billingProfile } = await supabase
    .from("profiles")
    .select(
      "subscription_status, preps_used_this_month, preps_reset_at, prep_credits, preps_this_billing_cycle, billing_cycle_started_at",
    )
    .eq("id", user.id)
    .single();

  const nowIso = new Date().toISOString();
  const p = billingProfile as Partial<ProfileBilling> | null;
  const billing: ProfileBilling = {
    subscription_status: p?.subscription_status ?? "none",
    preps_used_this_month: p?.preps_used_this_month ?? 0,
    preps_reset_at: p?.preps_reset_at ?? nowIso,
    prep_credits: p?.prep_credits ?? 0,
    preps_this_billing_cycle: p?.preps_this_billing_cycle ?? 0,
    billing_cycle_started_at: p?.billing_cycle_started_at ?? nowIso,
  };

  // Reset preguiçoso do ciclo, igual ao createPrep: virou o mês, zera o
  // contador ANTES de checar o soft cap.
  const now = new Date();
  let cycleResetThisRequest = false;
  if (isNewBillingCycle(new Date(billing.billing_cycle_started_at), now)) {
    billing.preps_this_billing_cycle = 0;
    billing.billing_cycle_started_at = nowIso;
    cycleResetThisRequest = true;
  }

  const quota = checkQuota(billing, now);
  if (!quota.allowed) {
    return { error: quota.mode === "pro_soft_cap" ? "pro_soft_cap" : "quota_exceeded" };
  }

  // Transição atômica ANTES de cobrar a cota. Sem isto, dois cliques (ou duas
  // abas) passariam os dois pelo gate: o pipeline roda em background, então a
  // prep continua com `prep_guide` nulo por algumas centenas de ms depois do
  // redirect — tempo de sobra pro segundo clique ser aceito e cobrar uma
  // segunda preparação da conta.
  //
  // O `.is("prep_guide", null)` é o cadeado: no Postgres o segundo UPDATE
  // reavalia a condição depois de esperar o lock do primeiro, encontra o
  // guia já preenchido e afeta 0 linhas. Quem perde a corrida sai por aqui
  // sem ter consumido nada.
  //
  // O placeholder gravado é exatamente o mesmo que o `runPipeline` escreve
  // no seu primeiro update (`{ meta, sections: [] }`), e é sobrescrito por
  // ele segundos depois. Efeito colateral desejado: com `prep_guide` não
  // nulo, o layout para de mostrar o CTA e passa a mostrar o skeleton.
  const { data: claimed } = await supabase
    .from("prep_sessions")
    .update({
      generation_status: "pending",
      error_message: null,
      prep_guide: {
        meta: {
          role: session.job_title ?? "esta vaga",
          company: session.company_name ?? "a empresa",
          estimated_prep_time_minutes: 30,
        },
        sections: [],
      },
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .is("prep_guide", null)
    .select("id");

  if (!claimed || claimed.length === 0) redirect(`/prep/${sessionId}`);

  // Consumo da cota — colunas server-managed, escritas pelo admin client
  // (o papel `authenticated` não tem GRANT de UPDATE nelas). A posse da
  // sessão e o estado da cota já foram verificados acima.
  const admin = createAdminClient();
  if (quota.mode === "credit") {
    await admin
      .from("profiles")
      .update({ prep_credits: billing.prep_credits - 1 })
      .eq("id", user.id);
  } else if (quota.mode === "pro") {
    const update: Record<string, unknown> = {
      preps_used_this_month: billing.preps_used_this_month + 1,
      preps_this_billing_cycle: billing.preps_this_billing_cycle + 1,
    };
    if (cycleResetThisRequest) {
      update.billing_cycle_started_at = billing.billing_cycle_started_at;
    }
    await admin.from("profiles").update(update).eq("id", user.id);
  } else {
    await admin
      .from("profiles")
      .update({ preps_used_this_month: billing.preps_used_this_month + 1 })
      .eq("id", user.id);
  }

  // A prep continua em `pending`, que é exatamente o estado que o
  // `runPipeline` aceita.
  runGenerationInBackground(sessionId);

  redirect(`/prep/${sessionId}`);
}

/**
 * Cópia deliberada do helper homônimo em `prep/new/actions.ts`: aquele arquivo
 * é "use server" e não pode exportar função síncrona.
 */
function runGenerationInBackground(sessionId: string): void {
  const t0 = Date.now();
  console.log(`[generateFullPrep] background start sessionId=${sessionId}`);
  import("@/app/prep/new/generation")
    .then(({ runGeneration }) => runGeneration(sessionId))
    .then(() => {
      console.log(
        `[generateFullPrep] background done sessionId=${sessionId} ${Date.now() - t0}ms`,
      );
    })
    .catch((err) => {
      console.error(
        `[generateFullPrep] background CRASHED sessionId=${sessionId}`,
        err instanceof Error ? err.message : String(err),
      );
    });
}
