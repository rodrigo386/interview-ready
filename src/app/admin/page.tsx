import type { Metadata } from "next";
import { getAdminOverview } from "@/lib/admin/metrics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin · PrepaVAGA",
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

export default async function AdminPage() {
  const overview = await getAdminOverview();

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
