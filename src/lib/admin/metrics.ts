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
export type OverviewRpc = {
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

  return {
    kpis: buildKpis(o),
    latestSignups: a.latestSignups ?? [],
    latestPreps: a.latestPreps ?? [],
    latestPayments: a.latestPayments ?? [],
    failedPreps: a.failedPreps ?? [],
  };
}

/**
 * Monta os KPIs do topo do `/admin` a partir do retorno cru do RPC.
 *
 * Exportada (e pura) só pra ser testável — a função que a chama depende do
 * service-role client e de dois RPCs.
 *
 * Não existe mais MRR aqui, e a ausência é deliberada. O card "MRR estimado"
 * calculava `proActive × R$30 + overdue × R$15` num produto que deixou de ter
 * assinatura: desde a migração pra crédito avulso, o único perfil com
 * `tier=pro` é a conta admin (que ganha Pro permanente por ser admin, sem
 * nunca ter pago mensalidade). O card mostrava receita recorrente que não
 * existe — pior do que não mostrar nada, porque é o número que se olha pra
 * decidir preço. Receita real agora é "Receita últimos 30d", que soma
 * pagamentos de fato liquidados.
 */
export function buildKpis(o: OverviewRpc): Kpi[] {
  const activationRate =
    o.signups30d === 0 ? 0 : Math.round((o.activated30d / o.signups30d) * 100);

  // Sobrevivente do modelo antigo: some quando zera, e enquanto existir diz o
  // que de fato é. `checkQuota` só olha `prep_credits` — `tier=pro` não
  // destrava preparação nenhuma (mesmo aviso que o GrantProButton dá).
  const legadoPro: Kpi[] =
    o.proActive + o.overdue > 0
      ? [
          {
            label: "Pro legado (não destrava nada)",
            value: o.proActive.toLocaleString("pt-BR"),
            hint: o.overdue
              ? `+${o.overdue} em atraso · sem efeito na cota`
              : "Sem efeito na cota",
          },
        ]
      : [];

  return [
    { label: "Total de usuários", value: o.totalUsers.toLocaleString("pt-BR") },
    { label: "Receita últimos 30d (R$)", value: brl(o.revenueCents30d) },
    ...legadoPro,
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
    {
      // Não é "saldo de cortesia": é preparação já paga e ainda não entregue.
      // O rótulo antigo ("Créditos avulsos no sistema") descrevia o mecanismo,
      // não a obrigação, e no modelo de crédito pré-pago essa é a única
      // métrica que diz quanto produto ainda se deve.
      label: "Créditos não consumidos",
      value: o.totalCredits.toLocaleString("pt-BR"),
      hint: "Preparações pagas e ainda não entregues",
    },
  ];
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
