import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRO_MONTHLY_SOFT_CAP } from "@/lib/billing/quota";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Saúde · Admin · PrepaVAGA",
  robots: { index: false, follow: false },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function HealthAdminPage() {
  const sb = createAdminClient();
  const last7d = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const last24h = new Date(Date.now() - DAY_MS).toISOString();

  const [
    failedPrepsRes,
    failedAtsRes,
    failedIntelRes,
    failedRewriteRes,
    pendingPaymentsRes,
    overduePaymentsRes,
    recentEventsRes,
    stuckPrepsRes,
    preps24hRes,
    proSoftCapRes,
  ] = await Promise.all([
    sb
      .from("prep_sessions")
      .select("id, user_id, company_name, error_message, created_at")
      .eq("generation_status", "failed")
      .gte("created_at", last7d)
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("prep_sessions")
      .select("id, company_name, ats_error_message, created_at")
      .eq("ats_status", "failed")
      .gte("created_at", last7d)
      .order("created_at", { ascending: false })
      .limit(10),
    sb
      .from("prep_sessions")
      .select("id, company_name, company_intel_error, created_at")
      .eq("company_intel_status", "failed")
      .gte("created_at", last7d)
      .order("created_at", { ascending: false })
      .limit(10),
    sb
      .from("prep_sessions")
      .select("id, company_name, cv_rewrite_error, created_at")
      .eq("cv_rewrite_status", "failed")
      .gte("created_at", last7d)
      .order("created_at", { ascending: false })
      .limit(10),
    sb.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("payments").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    sb
      .from("subscription_events")
      .select("id, event_type, asaas_payment_id, received_at")
      .gte("received_at", last24h)
      .order("received_at", { ascending: false })
      .limit(10),
    sb
      .from("prep_sessions")
      .select("id, company_name, generation_status, created_at")
      .in("generation_status", ["pending", "generating"])
      .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString()),
    sb
      .from("prep_sessions")
      .select("user_id")
      .gte("created_at", last24h),
    sb
      .from("profiles")
      .select("id, email, preps_this_billing_cycle, billing_cycle_started_at")
      .gte("preps_this_billing_cycle", PRO_MONTHLY_SOFT_CAP)
      .in("subscription_status", ["active", "overdue"])
      .order("preps_this_billing_cycle", { ascending: false })
      .limit(20),
  ]);

  const failedPreps = (failedPrepsRes.data ?? []) as Array<{
    id: string;
    user_id: string;
    company_name: string;
    error_message: string | null;
    created_at: string;
  }>;
  const failedAts = (failedAtsRes.data ?? []) as Array<{
    id: string;
    company_name: string;
    ats_error_message: string | null;
    created_at: string;
  }>;
  const failedIntel = (failedIntelRes.data ?? []) as Array<{
    id: string;
    company_name: string;
    company_intel_error: string | null;
    created_at: string;
  }>;
  const failedRewrite = (failedRewriteRes.data ?? []) as Array<{
    id: string;
    company_name: string;
    cv_rewrite_error: string | null;
    created_at: string;
  }>;
  const events = (recentEventsRes.data ?? []) as Array<{
    id: string;
    event_type: string;
    asaas_payment_id: string | null;
    received_at: string;
  }>;
  const stuckPreps = (stuckPrepsRes.data ?? []) as Array<{
    id: string;
    company_name: string;
    generation_status: string;
    created_at: string;
  }>;

  // Top users by preps in the last 24h. With createPrep capped at 3/h,
  // anyone north of 5 in a day is sustained heavy usage worth a look.
  const preps24hRows = (preps24hRes.data ?? []) as Array<{ user_id: string }>;
  const counts = new Map<string, number>();
  for (const row of preps24hRows) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  const topUsers = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([user_id, count]) => ({ user_id, count }));

  let topUsersWithEmail: Array<{ user_id: string; count: number; email: string | null }> = [];
  if (topUsers.length > 0) {
    const { data: profileRows } = await sb
      .from("profiles")
      .select("id, email")
      .in("id", topUsers.map((u) => u.user_id));
    const emailById = new Map<string, string | null>();
    for (const p of (profileRows ?? []) as Array<{ id: string; email: string | null }>) {
      emailById.set(p.id, p.email);
    }
    topUsersWithEmail = topUsers.map((u) => ({
      ...u,
      email: emailById.get(u.user_id) ?? null,
    }));
  }

  const ABUSE_THRESHOLD = 5;
  const flaggedTopUsers = topUsersWithEmail.filter((u) => u.count >= ABUSE_THRESHOLD);

  const proSoftCap = (proSoftCapRes.data ?? []) as Array<{
    id: string;
    email: string | null;
    preps_this_billing_cycle: number;
    billing_cycle_started_at: string;
  }>;

  const cards = [
    { label: "Preps falhadas (7d)", value: failedPreps.length, tone: failedPreps.length > 0 ? "warn" : "ok" },
    { label: "ATS falhadas (7d)", value: failedAts.length, tone: failedAts.length > 0 ? "warn" : "ok" },
    { label: "Intel falhadas (7d)", value: failedIntel.length, tone: failedIntel.length > 0 ? "warn" : "ok" },
    { label: "CV rewrite falhadas (7d)", value: failedRewrite.length, tone: failedRewrite.length > 0 ? "warn" : "ok" },
    { label: "Pagamentos pendentes", value: pendingPaymentsRes.count ?? 0, tone: "ok" },
    { label: "Pagamentos em atraso", value: overduePaymentsRes.count ?? 0, tone: (overduePaymentsRes.count ?? 0) > 0 ? "warn" : "ok" },
    { label: "Webhooks últimas 24h", value: events.length, tone: events.length === 0 ? "warn" : "ok" },
    { label: "Preps travadas (>30 min em pending/generating)", value: stuckPreps.length, tone: stuckPreps.length > 0 ? "warn" : "ok" },
    {
      label: `Users acima de ${ABUSE_THRESHOLD} preps/24h`,
      value: flaggedTopUsers.length,
      tone: flaggedTopUsers.length > 0 ? "warn" : "ok",
    },
    {
      label: `Pro acima do soft cap (${PRO_MONTHLY_SOFT_CAP}/mês)`,
      value: proSoftCap.length,
      tone: proSoftCap.length > 0 ? "warn" : "ok",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Saúde do sistema
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Indicadores e falhas recentes para investigar.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={
              "rounded-xl border p-4 " +
              (c.tone === "warn"
                ? "border-yellow-soft bg-yellow-soft/30 dark:border-yellow-900 dark:bg-yellow-950/30"
                : "border-neutral-200 bg-bg dark:border-zinc-800")
            }
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">
              {c.value.toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>

      <ErrorList
        title="Preps de geração falhadas"
        rows={failedPreps.map((p) => ({
          id: p.id,
          company: p.company_name,
          message: p.error_message,
          created_at: p.created_at,
        }))}
      />
      <ErrorList
        title="ATS falhadas"
        rows={failedAts.map((p) => ({
          id: p.id,
          company: p.company_name,
          message: p.ats_error_message,
          created_at: p.created_at,
        }))}
      />
      <ErrorList
        title="Pesquisa de empresa falhada"
        rows={failedIntel.map((p) => ({
          id: p.id,
          company: p.company_name,
          message: p.company_intel_error,
          created_at: p.created_at,
        }))}
      />
      <ErrorList
        title="CV rewrite falhada"
        rows={failedRewrite.map((p) => ({
          id: p.id,
          company: p.company_name,
          message: p.cv_rewrite_error,
          created_at: p.created_at,
        }))}
      />

      {stuckPreps.length > 0 && (
        <section className="rounded-xl border border-yellow-soft bg-yellow-soft/30 p-5 dark:border-yellow-900 dark:bg-yellow-950/30">
          <h2 className="text-base font-semibold text-text-primary">
            Preps travadas há mais de 30 min
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
            {stuckPreps.map((p) => (
              <li key={p.id} className="font-mono text-xs">
                {p.id.slice(0, 8)} · {p.company_name} · {p.generation_status} ·{" "}
                {new Date(p.created_at).toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        className={
          "rounded-xl border p-5 " +
          (flaggedTopUsers.length > 0
            ? "border-yellow-soft bg-yellow-soft/30 dark:border-yellow-900 dark:bg-yellow-950/30"
            : "border-neutral-200 bg-bg dark:border-zinc-800")
        }
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-text-primary">
            Top users por preps (últimas 24h)
          </h2>
          <span className="text-[11px] text-text-tertiary">
            limite: {ABUSE_THRESHOLD}+ marca em amarelo
          </span>
        </div>
        {topUsersWithEmail.length === 0 ? (
          <p className="mt-3 text-sm text-text-tertiary">
            Nenhuma prep nas últimas 24h.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {topUsersWithEmail.map((u) => (
              <li
                key={u.user_id}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-200/60 bg-bg px-3 py-2 dark:border-zinc-800/60 dark:bg-zinc-900/40"
              >
                <span className="truncate text-text-secondary">
                  <a
                    href={`/admin/users?q=${encodeURIComponent(u.email ?? u.user_id)}`}
                    className="font-medium text-text-primary hover:underline"
                  >
                    {u.email ?? u.user_id.slice(0, 8)}
                  </a>
                </span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums " +
                    (u.count >= ABUSE_THRESHOLD
                      ? "bg-yellow-soft text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                      : "bg-neutral-100 text-text-secondary dark:bg-zinc-800")
                  }
                >
                  {u.count} prep{u.count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {proSoftCap.length > 0 && (
        <section className="rounded-xl border border-yellow-soft bg-yellow-soft/30 p-5 dark:border-yellow-900 dark:bg-yellow-950/30">
          <h2 className="text-base font-semibold text-text-primary">
            Pro acima do soft cap mensal
          </h2>
          <p className="mt-1 text-xs text-text-tertiary">
            Atingiram {PRO_MONTHLY_SOFT_CAP}+ preps no ciclo atual. Entram em
            soft block até falar com você (rodrigo@proaicircle.com) ou virar mês.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {proSoftCap.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-md border border-yellow-soft/60 bg-bg px-3 py-2 dark:border-yellow-900/60 dark:bg-zinc-900/40"
              >
                <span className="truncate">
                  <a
                    href={`/admin/users?q=${encodeURIComponent(u.email ?? u.id)}`}
                    className="font-medium text-text-primary hover:underline"
                  >
                    {u.email ?? u.id.slice(0, 8)}
                  </a>
                  <span className="ml-2 text-[11px] text-text-tertiary">
                    desde {new Date(u.billing_cycle_started_at).toLocaleDateString("pt-BR")}
                  </span>
                </span>
                <span className="rounded-full bg-yellow-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                  {u.preps_this_billing_cycle} preps
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-bg p-5 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-text-primary">
          Eventos Asaas (últimas 24h)
        </h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-text-tertiary">
            Nenhum webhook recebido nas últimas 24h. Pode ser normal (sem pagamentos) ou indicar problema de conectividade.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-xs">
            {events.map((e) => (
              <li key={e.id} className="font-mono text-text-secondary">
                {new Date(e.received_at).toLocaleString("pt-BR")} ·{" "}
                <span className="font-semibold text-text-primary">{e.event_type}</span>
                {e.asaas_payment_id ? ` · ${e.asaas_payment_id}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ErrorList({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; company: string; message: string | null; created_at: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-xl border border-red-soft bg-red-soft/20 p-5 dark:border-red-900 dark:bg-red-950/20">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="rounded-md border border-red-soft/60 bg-bg p-3 dark:border-red-900/60 dark:bg-zinc-900/40">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-tertiary">
              <span className="font-medium text-text-primary">{r.company}</span>
              <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
            </div>
            {r.message && (
              <p className="mt-2 line-clamp-3 text-xs text-red-700 dark:text-red-300">
                {r.message}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
