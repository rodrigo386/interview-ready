"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkQuota } from "@/lib/billing/quota";
import { consumePrepCredit, refundPrepCredit } from "@/lib/billing/consume";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";
import { decideFullPrepGeneration } from "@/lib/prep/full-prep";

export type GenerateFullPrepState = {
  /** "quota_exceeded" é sentinela de UI, não texto. */
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
 * (`checkQuota` + `consumePrepCredit`) em vez de reaproveitar o `retryPrep`,
 * que é um caminho de recuperação de falha e de propósito não cobra nada —
 * ligar o CTA nele entregaria a preparação completa de graça.
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
    .select("prep_credits, is_admin")
    .eq("id", user.id)
    .single();

  const p = billingProfile as { prep_credits?: number; is_admin?: boolean } | null;
  const isAdmin = p?.is_admin === true;

  const quota = checkQuota({ prep_credits: p?.prep_credits ?? 0 }, isAdmin);
  if (!quota.allowed) {
    return { error: "quota_exceeded" };
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

  // Consumo atômico da cota — o RPC só tem GRANT pro service_role (migration
  // 0024), por isso vai pelo admin client. Se falhar (sem saldo ou erro),
  // barra aqui e NÃO dispara a geração: a claim acima já marcou a sessão
  // como "pending" com o placeholder, então o layout mostra skeleton em vez
  // do CTA — mas sem crédito consumido, ninguém gera de graça.
  const admin = createAdminClient();
  const consumed = await consumePrepCredit(admin, user.id, isAdmin);
  if (!consumed) {
    return { error: "quota_exceeded" };
  }

  // A prep continua em `pending`, que é exatamente o estado que o
  // `runPipeline` aceita.
  //
  // Passa userId/isAdmin pra devolver o crédito se a geração falhar — ver
  // comentário dentro de runGenerationInBackground sobre por que isso não
  // dá pra fazer só no .catch.
  runGenerationInBackground(sessionId, { userId: user.id, isAdmin });

  redirect(`/prep/${sessionId}`);
}

/**
 * Cópia deliberada do helper homônimo em `prep/new/actions.ts`: aquele arquivo
 * é "use server" e não pode exportar função síncrona.
 */
function runGenerationInBackground(
  sessionId: string,
  refundOnFailure: { userId: string; isAdmin: boolean },
): void {
  const t0 = Date.now();
  console.log(`[generateFullPrep] background start sessionId=${sessionId}`);
  import("@/app/prep/new/generation")
    .then(({ runGeneration }) => runGeneration(sessionId))
    .then(async () => {
      console.log(
        `[generateFullPrep] background done sessionId=${sessionId} ${Date.now() - t0}ms`,
      );
      // runPipeline (src/lib/ai/pipeline.ts) NUNCA lança — todo desfecho,
      // inclusive falha, é gravado como status terminal no banco e a promise
      // resolve normalmente. Por isso o único jeito confiável de saber se
      // esta geração falhou é reler o status gravado, não confiar só no
      // .catch abaixo (que só pega crash que escapou do try/catch interno).
      const adminClient = createAdminClient();
      const { data } = await adminClient
        .from("prep_sessions")
        .select("generation_status")
        .eq("id", sessionId)
        .single();
      if (
        (data as { generation_status?: string } | null)?.generation_status ===
        "failed"
      ) {
        await refundPrepCredit(adminClient, refundOnFailure.userId, refundOnFailure.isAdmin);
      }
    })
    .catch(async (err) => {
      console.error(
        `[generateFullPrep] background CRASHED sessionId=${sessionId}`,
        err instanceof Error ? err.message : String(err),
      );
      // Crash que escapou do try/catch interno do pipeline — ainda é falha
      // de geração, e quem pagou não recebeu.
      await refundPrepCredit(
        createAdminClient(),
        refundOnFailure.userId,
        refundOnFailure.isAdmin,
      );
    });
}
