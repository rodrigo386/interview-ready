import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Kpi = {
  label: string;
  value: string;
  hint?: string;
};

export type AdminOverview = {
  kpis: Kpi[];
  latestSignups: Array<{
    id: string;
    email: string;
    full_name: string | null;
    tier: string;
    subscription_status: string | null;
    created_at: string;
    is_admin: boolean;
  }>;
  latestPreps: Array<{
    id: string;
    user_id: string;
    user_email: string | null;
    company_name: string;
    job_title: string;
    generation_status: string;
    ats_status: string | null;
    created_at: string;
  }>;
  latestPayments: Array<{
    id: string;
    user_id: string;
    user_email: string | null;
    kind: string;
    amount_cents: number;
    status: string;
    paid_at: string | null;
    created_at: string;
  }>;
  failedPreps: Array<{
    id: string;
    user_email: string | null;
    company_name: string;
    error_message: string | null;
    created_at: string;
  }>;
};

// Shape returned by SQL function `get_admin_overview()` — see migration 0012.
type OverviewRpc = {
  totalUsers: number;
  signups24h: number;
  signups7d: number;
  signups30d: number;
  proActive: number;
  overdue: number;
  totalCredits: number;
  totalPreps: number;
  preps24h: number;
  preps7d: number;
  preps30d: number;
  failedPreps7d: number;
  successPreps30d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  activated30d: number;
  revenueCents30d: number;
  pendingPayments: number;
};

type RecentActivityRpc = {
  latestSignups: AdminOverview["latestSignups"];
  latestPreps: AdminOverview["latestPreps"];
  latestPayments: AdminOverview["latestPayments"];
  failedPreps: AdminOverview["failedPreps"];
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = createAdminClient();

  // Two RPCs in parallel = 2 round-trips total. Previous approach fired
  // 17 + 4 + 1 = 22 round-trips for the same data. The functions are
  // SECURITY DEFINER + REVOKE'd from anon/authenticated; only service_role
  // (which the admin client uses) can EXECUTE.
  const [overviewRes, activityRes] = await Promise.all([
    admin.rpc("get_admin_overview"),
    admin.rpc("get_admin_recent_activity"),
  ]);

  if (overviewRes.error) throw new Error(`get_admin_overview: ${overviewRes.error.message}`);
  if (activityRes.error) throw new Error(`get_admin_recent_activity: ${activityRes.error.message}`);

  const o = overviewRes.data as unknown as OverviewRpc;
  const a = activityRes.data as unknown as RecentActivityRpc;

  // Estimated MRR: active Pro subs × R$ 30 (promo). Overdue counted at half weight.
  const mrrCents = o.proActive * 3000 + o.overdue * 1500;
  const activationRate =
    o.signups30d === 0 ? 0 : Math.round((o.activated30d / o.signups30d) * 100);

  const kpis: Kpi[] = [
    { label: "Total de usuários", value: o.totalUsers.toLocaleString("pt-BR") },
    {
      label: "Assinantes Pro ativos",
      value: o.proActive.toLocaleString("pt-BR"),
      hint: o.overdue ? `+${o.overdue} em atraso` : undefined,
    },
    { label: "MRR estimado (R$)", value: brl(mrrCents), hint: "Pro × R$30 + 50% dos overdue" },
    { label: "Receita últimos 30d (R$)", value: brl(o.revenueCents30d) },
    {
      label: "Cadastros 24h",
      value: o.signups24h.toLocaleString("pt-BR"),
      hint: `${o.signups7d} em 7d · ${o.signups30d} em 30d`,
    },
    {
      label: "Preps geradas 24h",
      value: o.preps24h.toLocaleString("pt-BR"),
      hint: `${o.preps7d} em 7d · ${o.preps30d} em 30d`,
    },
    {
      label: "Usuários ativos 7d",
      value: o.activeUsers7d.toLocaleString("pt-BR"),
      hint: `${o.activeUsers30d} em 30d`,
    },
    {
      label: "Ativação 30d",
      value: `${activationRate}%`,
      hint: `${o.activated30d} de ${o.signups30d} cadastros`,
    },
    {
      label: "Total de preps",
      value: o.totalPreps.toLocaleString("pt-BR"),
      hint: `${o.successPreps30d} sucesso em 30d`,
    },
    {
      label: "Preps falhadas 7d",
      value: o.failedPreps7d.toLocaleString("pt-BR"),
      hint: o.failedPreps7d > 0 ? "Investigar abaixo" : undefined,
    },
    { label: "Pagamentos pendentes", value: o.pendingPayments.toLocaleString("pt-BR") },
    { label: "Créditos avulsos no sistema", value: o.totalCredits.toLocaleString("pt-BR") },
  ];

  return {
    kpis,
    latestSignups: a.latestSignups ?? [],
    latestPreps: a.latestPreps ?? [],
    latestPayments: a.latestPayments ?? [],
    failedPreps: a.failedPreps ?? [],
  };
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
