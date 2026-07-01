import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileBillingFromAsaas } from "@/lib/billing/reconcile";
import { sendWelcomeEmail } from "@/lib/email/welcome-email";
import { Button } from "@/components/ui/Button";
import { AtsScoreBadge } from "@/components/prep/AtsScoreBadge";
import { DeletePrepButton } from "@/components/prep/DeletePrepButton";
import { FreeTierBanner } from "@/components/billing/FreeTierBanner";

type SessionRow = {
  id: string;
  company_name: string;
  job_title: string;
  generation_status: string;
  created_at: string;
  ats_status: string | null;
  ats_score: string | null;
};

const STATUS: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  complete: {
    label: "pronto",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  generating: {
    label: "gerando",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    dot: "bg-amber-500 animate-pulse",
  },
  pending: {
    label: "pendente",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    dot: "bg-amber-500 animate-pulse",
  },
  failed: {
    label: "com erro",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    dot: "bg-red-500",
  },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const params = (await searchParams) ?? {};
  if (params.billing === "ok") {
    try {
      const admin = createAdminClient();
      await reconcileBillingFromAsaas(user.id, admin, "full");
    } catch (err) {
      console.warn("[dashboard] post-checkout reconcile failed:", err);
    }
    redirect("/dashboard");
  }

  const { data: sessions } = await supabase
    .from("prep_sessions")
    .select(
      "id, company_name, job_title, generation_status, created_at, ats_status, ats_score:ats_analysis->>score",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const list: SessionRow[] = sessions ?? [];

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(
      "full_name, is_admin, subscription_status, preps_used_this_month, preps_reset_at, prep_credits, welcome_email_sent_at",
    )
    .eq("id", user.id)
    .single();
  const billing = (profileRow ?? {}) as {
    full_name?: string | null;
    is_admin?: boolean;
    subscription_status?: "active" | "overdue" | "canceled" | "expired" | "none" | null;
    preps_used_this_month?: number;
    preps_reset_at?: string;
    prep_credits?: number;
    welcome_email_sent_at?: string | null;
  };

  // One-time welcome / first-prep nudge on first dashboard load. The conditional
  // update via the admin client is an atomic claim: it flips the flag only if
  // still null, so the email goes out at most once even under concurrent renders.
  // Never blocks the page; without RESEND_API_KEY sendEmail is a no-op.
  if (!billing.is_admin && billing.welcome_email_sent_at == null) {
    try {
      const admin = createAdminClient();
      const { data: claimed } = await admin
        .from("profiles")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", user.id)
        .is("welcome_email_sent_at", null)
        .select("id")
        .maybeSingle();
      if (claimed) {
        void sendWelcomeEmail({ to: user.email!, name: billing.full_name ?? null }).catch(
          (err) => console.warn("[dashboard] welcome email failed:", err),
        );
      }
    } catch (err) {
      console.warn("[dashboard] welcome email claim failed:", err);
    }
  }

  const showFreeTierBanner =
    billing.subscription_status !== "active" && billing.subscription_status !== "overdue";

  if (list.length === 0) {
    return (
      <div>
        {showFreeTierBanner && (
          <FreeTierBanner
            prepsUsedThisMonth={billing.preps_used_this_month ?? 0}
            credits={billing.prep_credits ?? 0}
          />
        )}
        <section className="mx-auto max-w-3xl py-10 md:py-16">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700">
              Bem-vindo
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
              Sua primeira preparação é grátis
              <span className="text-orange-500"> e vitalícia</span>
            </h1>
            <p className="mt-4 max-w-xl mx-auto text-base text-text-secondary md:text-lg">
              Cola o link da vaga e seu CV. Em ~60 segundos volta com o dossiê
              completo: ATS, empresa pesquisada, perguntas prováveis e roteiros.
            </p>

            <div className="mt-7">
              <Link href="/prep/new">
                <Button size="lg">Criar meu primeiro prep →</Button>
              </Link>
              <p className="mt-3 text-xs text-text-tertiary">
                Sem cartão. Pode usar agora.
              </p>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <PreviewCard
              eyebrow="Tela 1 · Visão geral"
              title="Pesquisa da empresa"
              body="Notícias recentes, contexto estratégico, pessoas-chave e perguntas que isso cria."
              accent="orange"
            />
            <PreviewCard
              eyebrow="Tela 2 · ATS"
              title="Score do seu CV vs. a vaga"
              body="Gauge + 3 issues prioritárias. CV reescrito pronto pra baixar em DOCX."
              accent="red"
            />
            <PreviewCard
              eyebrow="Telas 3-5 · Perguntas"
              title="Roteiros prontos pra resposta"
              body="Perguntas básicas, aprofundamento e perguntas estratégicas pra você fazer ao recrutador."
              accent="green"
            />
          </div>

          <div className="mt-10 rounded-2xl border border-line bg-bg p-5 text-sm text-text-secondary">
            <p className="font-medium text-text-primary">
              Tudo que você precisa pra começar:
            </p>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-start gap-2">
                <span aria-hidden className="text-orange-500">1.</span>
                <span>
                  <strong className="text-text-primary">Link da vaga</strong>{" "}
                  (LinkedIn, Gupy, Catho, site da empresa) — ou cola o texto.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="text-orange-500">2.</span>
                <span>
                  <strong className="text-text-primary">Seu CV</strong> em PDF,
                  DOCX ou texto colado.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="text-orange-500">3.</span>
                <span>
                  Aperta gerar. Em ~60 segundos o dossiê está pronto.
                </span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    );
  }

  const last30 = list.filter(
    (s) =>
      new Date(s.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length;

  return (
    <div>
      {showFreeTierBanner && (
        <FreeTierBanner
          prepsUsedThisMonth={billing.preps_used_this_month ?? 0}
          credits={billing.prep_credits ?? 0}
        />
      )}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            Seus preps
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {last30} {last30 === 1 ? "prep" : "preps"} nos últimos 30 dias
          </p>
        </div>
        <Link href="/prep/new">
          <Button>+ Novo prep</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => {
          const status = STATUS[s.generation_status] ?? STATUS.pending;
          return (
            <article
              key={s.id}
              className="group relative rounded-lg border border-border bg-bg p-6 transition-all hover:border-brand-400 hover:shadow-md"
            >
              <Link
                href={`/prep/${s.id}`}
                aria-label={`Abrir prep de ${s.company_name}`}
                className="absolute inset-0 z-0 rounded-lg"
              />
              <div className="pointer-events-none relative z-[1] flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold text-text-primary">
                    {s.company_name}
                  </h2>
                  <p className="mt-1 truncate text-base text-text-secondary">
                    {s.job_title}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="shrink-0 text-lg text-brand-600 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  →
                </span>
              </div>
              <div className="pointer-events-none relative z-[1] mt-4 flex flex-wrap items-center gap-2 text-sm text-text-tertiary">
                <span>
                  {new Date(s.created_at).toLocaleDateString("pt-BR", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span aria-hidden>·</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}
                >
                  <span
                    aria-hidden
                    className={`inline-block h-1.5 w-1.5 rounded-full ${status.dot}`}
                  />
                  {status.label}
                </span>
                {s.ats_status === "complete" &&
                  atsScoreFromRow(s) !== null && (
                    <AtsScoreBadge score={atsScoreFromRow(s) as number} />
                  )}
              </div>
              <div className="pointer-events-auto relative z-[2] mt-4 flex justify-end">
                <DeletePrepButton
                  sessionId={s.id}
                  companyName={s.company_name}
                  variant="compact"
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function atsScoreFromRow(row: SessionRow): number | null {
  if (row.ats_score == null) return null;
  const n = Number(row.ats_score);
  return Number.isFinite(n) ? n : null;
}

function PreviewCard({
  eyebrow,
  title,
  body,
  accent,
}: {
  eyebrow: string;
  title: string;
  body: string;
  accent: "orange" | "red" | "green";
}) {
  const dot =
    accent === "orange"
      ? "bg-orange-500"
      : accent === "red"
        ? "bg-red-500"
        : "bg-green-500";
  return (
    <div className="rounded-2xl border border-line bg-bg p-5 shadow-prep">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
          {eyebrow}
        </p>
      </div>
      <h3 className="mt-2 text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1.5 text-sm leading-snug text-text-secondary">{body}</p>
    </div>
  );
}
