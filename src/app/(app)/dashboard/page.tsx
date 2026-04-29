import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileBillingFromAsaas } from "@/lib/billing/reconcile";
import { Button } from "@/components/ui/Button";
import { AtsScoreBadge } from "@/components/prep/AtsScoreBadge";
import { DeletePrepButton } from "@/components/prep/DeletePrepButton";
import { Logo } from "@/components/Logo";
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
    .select("subscription_status, preps_used_this_month, preps_reset_at, prep_credits")
    .eq("id", user.id)
    .single();
  const billing = (profileRow ?? {}) as {
    subscription_status?: "active" | "overdue" | "canceled" | "expired" | "none" | null;
    preps_used_this_month?: number;
    preps_reset_at?: string;
    prep_credits?: number;
  };

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
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Logo variant="symbol" size={120} className="opacity-80" />
          <h1 className="mt-8 text-2xl font-semibold text-text-primary">
            Prepare sua primeira vaga
          </h1>
          <p className="mt-3 max-w-md text-sm text-text-secondary">
            Em minutos, você recebe o dossiê completo da vaga: empresa, CV, roteiros.
          </p>
          <Link href="/prep/new" className="mt-8">
            <Button size="lg">Criar meu primeiro prep</Button>
          </Link>
        </div>
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
