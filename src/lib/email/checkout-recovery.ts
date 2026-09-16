import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./send";
import { emailShell, escapeHtml, SITE_URL, SUPPORT_EMAIL } from "./layout";
import { atsAnalysisSchema, type AtsAnalysis } from "@/lib/ai/schemas";
import { palavrasFaltando, projetarScore } from "@/lib/ai/ats-keywords";
import { isCargoDesconhecido, isEmpresaDesconhecida } from "@/lib/anon-ats/core";

/**
 * E-mail pra quem abriu a cobrança e não pagou.
 *
 * Origem: em 14/09 a usuária mais engajada que o site já teve — duas análises
 * da mesma vaga, reescreveu o próprio título entre elas — clicou em pagar,
 * chegou ao Asaas e saiu sem escolher PIX nem cartão. Ninguém voltou a falar
 * com ela. Quem abandona depois de abrir a cobrança é o público de maior
 * intenção que existe: já decidiu comprar uma vez.
 *
 * Gatilho: o webhook PAYMENT_OVERDUE do Asaas, que chega quando a cobrança
 * vence (o checkout cria com vencimento no dia seguinte). É o atraso certo —
 * nem em cima do abandono, nem tarde demais — e dispensa cron. A
 * idempotência vem de graça: `subscription_events` tem UNIQUE no
 * `asaas_event_id`, então um reenvio do mesmo evento pelo Asaas nunca chega
 * aqui duas vezes.
 */

export type PendingPrep = {
  id: string;
  job_title: string | null;
  company_name: string | null;
  analysis: AtsAnalysis | null;
};

export type RecoveryEmailData = {
  name: string | null;
  prep: PendingPrep | null;
};

function primeiroNome(name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length > 1 ? first : "";
}

/** Pura: monta assunto, HTML e texto. Todo dado externo passa por escape. */
export function buildCheckoutRecoveryEmail(data: RecoveryEmailData): {
  subject: string;
  html: string;
  text: string;
  url: string;
} {
  const prep = data.prep;
  const cargo = prep && !isCargoDesconhecido(prep.job_title) ? prep.job_title! : null;
  const empresa =
    prep && !isEmpresaDesconhecida(prep.company_name) ? prep.company_name! : null;
  const analysis = prep?.analysis ?? null;
  const faltando = analysis ? palavrasFaltando(analysis) : [];
  const score = analysis?.score ?? null;
  const projetado = analysis ? projetarScore(analysis) : null;

  const url = prep ? `${SITE_URL}/prep/${prep.id}/ats` : `${SITE_URL}/dashboard`;
  const nome = primeiroNome(data.name);
  const alvo = cargo ? ` para ${cargo}` : "";

  const subject = `Seu currículo${alvo} ficou pela metade`;
  const heading = `${nome ? `${nome}, s` : "S"}eu currículo${alvo} ficou pela metade`;

  const e = escapeHtml;
  const listaHtml = faltando.map((t) => `<strong>${e(t)}</strong>`);
  const juntar = (xs: string[]) =>
    xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;

  const paragrafos: string[] = [];
  if (score !== null && projetado !== null && projetado > score) {
    paragrafos.push(
      `<p>Sua análise deu <strong>${score}</strong>. Incorporando o que falta, a nota pode chegar a <strong>até ${projetado}</strong>.</p>`,
    );
  } else {
    paragrafos.push(`<p>Sua análise ATS continua salva na sua conta.</p>`);
  }
  if (faltando.length > 0) {
    paragrafos.push(
      `<p>Hoje o seu currículo não menciona ${juntar(listaHtml)} — termos que a vaga pede. A preparação completa reescreve o currículo incluindo o que for compatível com a sua experiência.</p>`,
    );
  }
  paragrafos.push(
    `<p>E junto vêm${empresa ? ` a pesquisa atual sobre a <strong>${e(empresa)}</strong>,` : " a pesquisa atual sobre a empresa,"} a faixa salarial estimada e as perguntas prováveis com roteiro.</p>`,
    `<p style="font-size:13px;color:#8A8A8A;">R$10 · pagamento seguro pelo Asaas (PIX ou cartão) · reembolso em 7 dias se não gostar · sem assinatura.</p>`,
    `<p style="font-size:13px;color:#8A8A8A;">Não quer mais? É só ignorar este e-mail — não mandaremos outro sobre esta cobrança.</p>`,
  );

  const html = emailShell({
    heading: e(heading),
    body: paragrafos.join("\n"),
    cta: { url, label: "Terminar meu currículo →" },
  });

  const textoFaltando = faltando.length ? ` Hoje ele não menciona: ${juntar(faltando)}.` : "";
  const text =
    `${heading}.` +
    (score !== null ? ` Sua análise deu ${score}.` : "") +
    textoFaltando +
    ` Termine em ${url} — R$10, reembolso em 7 dias.`;

  return { subject, html, text, url };
}

export type RecoveryDeps = {
  loadProfile: (userId: string) => Promise<{
    email: string | null;
    full_name: string | null;
    prep_credits: number;
  } | null>;
  /** Existe pagamento concluído desta pessoa criado depois do abandono? */
  paidSince: (userId: string, asaasPaymentId: string) => Promise<boolean>;
  loadPendingPrep: (userId: string) => Promise<PendingPrep | null>;
  send: typeof sendEmail;
};

export type RecoveryResult =
  | { sent: true }
  | { sent: false; reason: "no_profile" | "no_email" | "has_credit" | "already_paid" | "send_failed" };

/**
 * Decide se manda e manda. Nunca lança — é chamado de dentro do webhook, e
 * falha de e-mail não pode virar retry do Asaas nem atrasar o registro do
 * pagamento.
 */
export async function sendCheckoutRecovery(
  userId: string,
  asaasPaymentId: string,
  deps: RecoveryDeps,
): Promise<RecoveryResult> {
  try {
    const profile = await deps.loadProfile(userId);
    if (!profile) return { sent: false, reason: "no_profile" };
    if (!profile.email) return { sent: false, reason: "no_email" };
    // Tem crédito = comprou de outro jeito (pacote, outra aba) ou ganhou
    // cortesia. Cobrar de novo seria mandar e-mail de venda pra cliente.
    if (profile.prep_credits > 0) return { sent: false, reason: "has_credit" };
    if (await deps.paidSince(userId, asaasPaymentId)) {
      return { sent: false, reason: "already_paid" };
    }

    const prep = await deps.loadPendingPrep(userId);
    const email = buildCheckoutRecoveryEmail({ name: profile.full_name, prep });
    const r = await deps.send({
      to: profile.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: SUPPORT_EMAIL,
    });
    return r.ok ? { sent: true } : { sent: false, reason: "send_failed" };
  } catch (err) {
    console.warn("[checkout-recovery] falhou:", err);
    return { sent: false, reason: "send_failed" };
  }
}

export function supabaseRecoveryDeps(supabase: SupabaseClient): RecoveryDeps {
  return {
    loadProfile: async (userId) => {
      const { data } = await supabase
        .from("profiles")
        .select("email, full_name, prep_credits")
        .eq("id", userId)
        .single();
      const p = data as { email: string | null; full_name: string | null; prep_credits: number | null } | null;
      return p ? { ...p, prep_credits: p.prep_credits ?? 0 } : null;
    },
    paidSince: async (userId, asaasPaymentId) => {
      const { data: abandonado } = await supabase
        .from("payments")
        .select("created_at")
        .eq("asaas_payment_id", asaasPaymentId)
        .maybeSingle();
      const desde = (abandonado as { created_at?: string } | null)?.created_at;
      let q = supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["received", "confirmed"]);
      if (desde) q = q.gte("created_at", desde);
      const { count } = await q;
      return (count ?? 0) > 0;
    },
    loadPendingPrep: async (userId) => {
      // A prep que a pessoa estava tentando pagar: a mais recente com análise
      // pronta e ainda sem preparação gerada.
      const { data } = await supabase
        .from("prep_sessions")
        .select("id, job_title, company_name, ats_analysis")
        .eq("user_id", userId)
        .eq("ats_status", "complete")
        .is("prep_guide", null)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = (data as Array<{
        id: string;
        job_title: string | null;
        company_name: string | null;
        ats_analysis: unknown;
      }> | null)?.[0];
      if (!row) return null;
      const parsed = atsAnalysisSchema.safeParse(row.ats_analysis);
      return {
        id: row.id,
        job_title: row.job_title,
        company_name: row.company_name,
        analysis: parsed.success ? parsed.data : null,
      };
    },
    send: sendEmail,
  };
}
