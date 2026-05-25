import type { Metadata } from "next";
import Link from "next/link";
import { getAdminOverview } from "@/lib/admin/metrics";
import {
  getPageViewMetrics,
  getPageViewDiagnostic,
  getPageViewPathBreakdown,
} from "@/lib/analytics/page-views";
import { createAdminClient } from "@/lib/supabase/admin";
import { IndexNowButton } from "@/components/admin/IndexNowButton";
import { TestTrackingButton } from "@/components/admin/TestTrackingButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin · PrepaVaga",
  robots: { index: false, follow: false },
};

const STATUS_BADGE: Record<string, string> = {
  complete: "bg-green-soft text-green-700 dark:bg-green-950/40 dark:text-green-300",
  generating: "bg-yellow-soft text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  pending: "bg-yellow-soft text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  failed: "bg-red-soft text-red-700 dark:bg-red-950/40 dark:text-red-300",
  active: "bg-green-soft text-green-700 dark:bg-green-950/40 dark:text-green-300",
  overdue: "bg-yellow-soft text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  canceled: "bg-neutral-100 text-text-secondary dark:bg-zinc-800 dark:text-zinc-300",
  expired: "bg-neutral-100 text-text-secondary dark:bg-zinc-800 dark:text-zinc-300",
  received: "bg-green-soft text-green-700 dark:bg-green-950/40 dark:text-green-300",
  confirmed: "bg-green-soft text-green-700 dark:bg-green-950/40 dark:text-green-300",
  refunded: "bg-neutral-100 text-text-secondary dark:bg-zinc-800 dark:text-zinc-300",
};

async function getPartnerStats(): Promise<{
  pending: number;
  active: number;
  payable_cents: number;
}> {
  try {
    const sb = createAdminClient();
    const [pendingRes, activeRes, payableRes] = await Promise.all([
      sb
        .from("affiliate_partners")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      sb
        .from("affiliate_partners")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      sb
        .from("affiliate_commissions")
        .select("amount_cents")
        .eq("status", "confirmed")
        .is("paid_at", null),
    ]);
    const payableCents = (payableRes.data ?? []).reduce(
      (acc, r) => acc + ((r as { amount_cents: number }).amount_cents ?? 0),
      0,
    );
    return {
      pending: pendingRes.count ?? 0,
      active: activeRes.count ?? 0,
      payable_cents: payableCents,
    };
  } catch {
    return { pending: 0, active: 0, payable_cents: 0 };
  }
}

export default async function AdminPage() {
  const [
    overview,
    pageViewsResult,
    partnerStats,
    pageViewDiagnostic,
    pathBreakdown,
  ] = await Promise.all([
    getAdminOverview(),
    getPageViewMetrics(),
    getPartnerStats(),
    getPageViewDiagnostic(),
    getPageViewPathBreakdown(),
  ]);
  const pageViews = pageViewsResult.ok ? pageViewsResult.metrics : null;
  const pageViewsError = pageViewsResult.ok ? null : pageViewsResult;

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Visão geral
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Métricas em tempo real. Atualiza a cada navegação.
        </p>
      </div>

      <Section title="Visitas ao site">
        {pageViews ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KPI
              label="Últimas 24h"
              total={pageViews.total_24h}
              unique={pageViews.unique_24h}
            />
            <KPI
              label="Últimos 7 dias"
              total={pageViews.total_7d}
              unique={pageViews.unique_7d}
            />
            <KPI
              label="Últimos 30 dias"
              total={pageViews.total_30d}
              unique={pageViews.unique_30d}
            />
            <KPI
              label="All-time"
              total={pageViews.total_all_time}
              unique={pageViews.unique_all_time}
            />
          </div>
        ) : pageViewsError?.reason === "table_missing" ? (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-soft p-4 text-sm">
            <p className="font-semibold text-yellow-700">
              Tabela page_views não existe
            </p>
            <p className="mt-1 text-ink-2">
              Migration 0018 não foi aplicada. Cole no SQL Editor do Supabase o
              conteúdo de{" "}
              <code className="rounded bg-bg px-1 font-mono text-xs">
                supabase/migrations/0018_page_views.sql
              </code>
              .
            </p>
            <p className="mt-1 text-xs text-ink-3">{pageViewsError.detail}</p>
          </div>
        ) : pageViewsError ? (
          <div className="rounded-xl border border-red-500/40 bg-red-soft p-4 text-sm">
            <p className="font-semibold text-red-700">
              Erro ao consultar visitas
            </p>
            <p className="mt-1 text-xs text-ink-3">{pageViewsError.detail}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-neutral-200 bg-bg p-4 text-sm text-text-tertiary dark:border-zinc-800">
            Sem dados de visitas ainda. Tracking começa após a próxima visita.
          </p>
        )}
        <p className="mt-2 text-xs text-text-tertiary">
          Bots filtrados por user-agent. Visitantes únicos identificados via cookie pv_vid (1 ano).
        </p>

        {pathBreakdown && pathBreakdown.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Top páginas (últimos 30 dias)
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              Onde os visitantes caem. Ajuda a decidir se o gargalo é tráfego
              (acima) ou conversão (abaixo).
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-semibold uppercase text-text-tertiary">
                  <tr className="border-b border-neutral-200 dark:border-zinc-800">
                    <th className="py-2 pr-3">Path</th>
                    <th className="py-2 pr-3 text-right">Visualizações</th>
                    <th className="py-2 text-right">Visitantes únicos</th>
                  </tr>
                </thead>
                <tbody>
                  {pathBreakdown.map((row) => (
                    <tr
                      key={row.path}
                      className="border-b border-neutral-100 last:border-0 dark:border-zinc-900"
                    >
                      <td className="py-2 pr-3 font-mono text-xs text-text-primary">
                        {row.path}
                      </td>
                      <td className="py-2 pr-3 text-right text-text-secondary">
                        {row.views.toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2 text-right text-text-secondary">
                        {row.uniqueVisitors.toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pageViewDiagnostic && (
          <details className="mt-4 rounded-xl border border-neutral-200 bg-bg p-4 text-sm dark:border-zinc-800">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Diagnóstico de tracking (clique para expandir)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DiagKpi label="Rows total" value={pageViewDiagnostic.totalRowsAllTime} />
              <DiagKpi label="Última 1h" value={pageViewDiagnostic.totalRowsLastHour} />
              <DiagKpi label="Humanos" value={pageViewDiagnostic.humanRows} />
              <DiagKpi label="Bots" value={pageViewDiagnostic.botRows} />
            </div>
            <div className="mt-4">
              <TestTrackingButton />
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Últimos 5 registros (sem filtro)
              </p>
              {pageViewDiagnostic.latestRows.length === 0 ? (
                <p className="mt-2 text-xs text-text-tertiary">
                  Nenhum row na tabela — middleware não está escrevendo. Verifica
                  envs <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
                  <code>SUPABASE_SERVICE_ROLE_KEY</code> no Railway, ou logs
                  Railway pra warnings <code>[analytics]</code>.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  {pageViewDiagnostic.latestRows.map((r, i) => (
                    <li
                      key={i}
                      className="rounded bg-bg px-2 py-1 dark:bg-zinc-900"
                    >
                      <span className={r.is_bot ? "text-yellow-700" : "text-green-700"}>
                        {r.is_bot ? "BOT" : "HUMAN"}
                      </span>{" "}
                      · {r.path} ·{" "}
                      <span className="text-text-tertiary">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </span>
                      {r.user_agent_truncated && (
                        <div className="mt-0.5 truncate text-text-muted">
                          UA: {r.user_agent_truncated}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        )}
      </Section>

      <Section title="SEO · IndexNow">
        <div className="rounded-xl border border-neutral-200 bg-bg p-5 dark:border-zinc-800">
          <p className="text-sm text-text-secondary">
            Pinga Bing/Yandex/Seznam pra recrawlar a landing, /pricing,
            /parceiros, /artigos e todos os artigos. Use após publicar conteúdo
            novo ou quando indexação parecer estagnada.
          </p>
          <div className="mt-4">
            <IndexNowButton />
          </div>
        </div>
      </Section>

      <Section title="Programa de parceiros">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/admin/affiliates?tab=applications"
            className="rounded-xl border border-orange-500 bg-orange-soft/30 p-5 transition hover:bg-orange-soft/60"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-700">
              Aplicações pendentes
            </p>
            <p className="mt-2 text-3xl font-bold text-ink">
              {partnerStats.pending}
            </p>
            <p className="mt-1 text-xs text-ink-2">
              Aprovar ou negar →
            </p>
          </Link>
          <Link
            href="/admin/affiliates?tab=active"
            className="rounded-xl border border-neutral-200 bg-bg p-5 transition hover:bg-neutral-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Parceiros ativos
            </p>
            <p className="mt-2 text-3xl font-bold text-text-primary">
              {partnerStats.active}
            </p>
            <p className="mt-1 text-xs text-text-secondary">Gerenciar →</p>
          </Link>
          <Link
            href="/admin/affiliates?tab=active"
            className="rounded-xl border border-neutral-200 bg-bg p-5 transition hover:bg-neutral-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              A pagar agora
            </p>
            <p className="mt-2 text-3xl font-bold text-text-primary">
              R$ {(partnerStats.payable_cents / 100).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Comissões confirmadas →
            </p>
          </Link>
        </div>
      </Section>

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {overview.kpis.map((kpi) => (
            <article
              key={kpi.label}
              className="rounded-xl border border-neutral-200 bg-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-800"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                {kpi.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-text-primary">{kpi.value}</p>
              {kpi.hint && (
                <p className="mt-1 text-[11px] text-text-tertiary">{kpi.hint}</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <Section title="Últimos cadastros">
        <Table
          headers={["E-mail", "Nome", "Plano", "Status", "Quando"]}
          rows={overview.latestSignups.map((u) => [
            <span key="email" className="flex items-center gap-2">
              {u.email}
              {u.is_admin && (
                <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-700 dark:bg-brand-900/30 dark:text-brand-500">
                  admin
                </span>
              )}
            </span>,
            u.full_name ?? "-",
            <Badge key="tier" tone={u.tier === "pro" ? "active" : "canceled"}>{u.tier}</Badge>,
            <Badge key="status" tone={u.subscription_status ?? "canceled"}>
              {u.subscription_status ?? "free"}
            </Badge>,
            relativeTime(u.created_at),
          ])}
        />
      </Section>

      <Section title="Últimas preps">
        <Table
          headers={["Empresa · Cargo", "Usuário", "Geração", "ATS", "Quando"]}
          rows={overview.latestPreps.map((p) => [
            <span key="job" className="font-medium text-text-primary">
              {p.company_name} <span className="text-text-tertiary">·</span>{" "}
              <span className="text-text-secondary">{p.job_title}</span>
            </span>,
            p.user_email ?? p.user_id.slice(0, 8),
            <Badge key="gen" tone={p.generation_status}>{p.generation_status}</Badge>,
            p.ats_status ? <Badge key="ats" tone={p.ats_status}>{p.ats_status}</Badge> : "-",
            relativeTime(p.created_at),
          ])}
        />
      </Section>

      <Section title="Últimos pagamentos">
        <Table
          headers={["Usuário", "Tipo", "Valor", "Status", "Pago em", "Criado"]}
          rows={overview.latestPayments.map((p) => [
            p.user_email ?? p.user_id.slice(0, 8),
            <Badge key="kind" tone="active">
              {p.kind === "pro_subscription" ? "Pro" : "Avulso"}
            </Badge>,
            <span key="amt" className="font-mono text-text-primary">
              R$ {(p.amount_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>,
            <Badge key="st" tone={p.status}>{p.status}</Badge>,
            p.paid_at ? relativeTime(p.paid_at) : "-",
            relativeTime(p.created_at),
          ])}
          empty="Sem pagamentos ainda."
        />
      </Section>

      {overview.failedPreps.length > 0 && (
        <Section title="Preps falhadas (últimas 10)">
          <Table
            headers={["Usuário", "Empresa", "Erro", "Quando"]}
            rows={overview.failedPreps.map((p) => [
              p.user_email ?? "-",
              p.company_name,
              <span
                key="err"
                className="line-clamp-2 max-w-md text-xs text-red-700 dark:text-red-300"
              >
                {p.error_message ?? "(sem mensagem)"}
              </span>,
              relativeTime(p.created_at),
            ])}
          />
        </Section>
      )}
    </div>
  );
}

function KPI({
  label,
  total,
  unique,
}: {
  label: string;
  total: number;
  unique: number;
}) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-800">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">
        {total.toLocaleString("pt-BR")}
      </p>
      <p className="mt-1 text-xs text-text-tertiary">
        {unique.toLocaleString("pt-BR")} únicos
      </p>
    </article>
  );
}

function DiagKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-bg p-3 dark:border-zinc-800">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-text-primary">
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 bg-bg p-8 text-center text-sm text-text-tertiary dark:border-zinc-800">
        {empty ?? "Sem dados ainda."}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-text-tertiary dark:bg-zinc-900/40">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-zinc-800">
            {rows.map((row, i) => (
              <tr key={i} className="bg-bg hover:bg-neutral-50/60 dark:hover:bg-zinc-900/40">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 align-top text-text-secondary">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const cls =
    STATUS_BADGE[tone] ?? "bg-neutral-100 text-text-secondary dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
