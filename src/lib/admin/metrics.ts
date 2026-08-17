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

/**
 * Funil da ferramenta ATS anônima (`anon_ats_analyses`, migration 0023).
 *
 * Não vem do `get_admin_overview` porque aquele RPC é da migration 0012 e
 * mudá-lo exige migration nova aplicada à mão em produção. Uma query a mais
 * numa página de admin é troca barata por não bloquear a visibilidade do
 * topo de funil atrás de um deploy de banco.
 */
export type AnonFunnel = {
  last24h: number;
  last7d: number;
  last30d: number;
  claimed30d: number;
  failed30d: number;
};

async function getAnonFunnel(
  admin: ReturnType<typeof createAdminClient>,
): Promise<AnonFunnel | null> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("anon_ats_analyses")
    .select("created_at, claimed_at, status")
    .gte("created_at", since30d);

  // Tabela ausente (0023 não aplicada) ou qualquer outra falha não pode
  // derrubar o /admin inteiro — o resto dos KPIs continua útil. Some da tela
  // e loga.
  if (error) {
    console.warn("[admin] anon_ats_analyses indisponível:", error.message);
    return null;
  }

  const now = Date.now();
  const d1 = now - 24 * 60 * 60 * 1000;
  const d7 = now - 7 * 24 * 60 * 60 * 1000;
  const rows = (data ?? []) as {
    created_at: string;
    claimed_at: string | null;
    status: string;
  }[];

  let last24h = 0;
  let last7d = 0;
  let claimed30d = 0;
  let failed30d = 0;
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (t >= d1) last24h++;
    if (t >= d7) last7d++;
    if (r.claimed_at) claimed30d++;
    if (r.status === "failed") failed30d++;
  }

  return { last24h, last7d, last30d: rows.length, claimed30d, failed30d };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = createAdminClient();

  // Two RPCs in parallel = 2 round-trips total. Previous approach fired
  // 17 + 4 + 1 = 22 round-trips for the same data. The functions are
  // SECURITY DEFINER + REVOKE'd from anon/authenticated; only service_role
  // (which the admin client uses) can EXECUTE.
  const [overviewRes, activityRes, anon] = await Promise.all([
    admin.rpc("get_admin_overview"),
    admin.rpc("get_admin_recent_activity"),
    getAnonFunnel(admin),
  ]);

  if (overviewRes.error) throw new Error(`get_admin_overview: ${overviewRes.error.message}`);
  if (activityRes.error) throw new Error(`get_admin_recent_activity: ${activityRes.error.message}`);

  const o = overviewRes.data as unknown as OverviewRpc;
  const a = activityRes.data as unknown as RecentActivityRpc;

  return {
    kpis: buildKpis(o, anon),
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
 *
 * A outra distorção corrigida aqui é a contagem de "preps". O RPC conta
 * linhas de `prep_sessions`, e desde que a análise ATS virou grátis TODA
 * análise cria uma linha — o card "Preps geradas 24h" passou a somar produto
 * grátis com produto pago no mesmo número, justo o corte que importa agora.
 * Não dá pra separar por `generation_status` (a sessão só-ATS fica em
 * `pending` pra sempre, igual a uma paga que ainda não rodou); o marcador é
 * `prep_guide`, e ele não está no RPC. Em vez de exigir migration nova, o
 * card foi renomeado pro que de fato mede (**análises**) e a preparação paga
 * ganhou card próprio com `successPreps30d`, que já significa exatamente
 * "pipeline pago concluído".
 */
export function buildKpis(o: OverviewRpc, anon: AnonFunnel | null = null): Kpi[] {
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

  // Topo de funil sem cadastro. Some quando a 0023 não está aplicada — ver
  // getAnonFunnel. A taxa de reivindicação é a pergunta que a ferramenta
  // existe pra responder: quantos anônimos viram conta.
  const anonKpis: Kpi[] = anon
    ? [
        {
          label: "Análises anônimas 24h",
          value: anon.last24h.toLocaleString("pt-BR"),
          hint: `${anon.last7d} em 7d · ${anon.last30d} em 30d`,
        },
        {
          label: "Anônimas viradas em conta (30d)",
          value: `${pct(anon.claimed30d, anon.last30d)}%`,
          hint: `${anon.claimed30d} de ${anon.last30d} reivindicadas`,
        },
        ...(anon.failed30d > 0
          ? [
              {
                label: "Análises anônimas falhadas 30d",
                value: anon.failed30d.toLocaleString("pt-BR"),
                hint: "Checar teto diário e Gemini em Saúde",
              },
            ]
          : []),
      ]
    : [];

  return [
    { label: "Total de usuários", value: o.totalUsers.toLocaleString("pt-BR") },
    { label: "Receita últimos 30d (R$)", value: brl(o.revenueCents30d) },
    {
      // O número que vale dinheiro: pipeline pago concluído. Estava escondido
      // como hint do "Total de preps", enquanto o card grande contava análise
      // grátis.
      label: "Preparações entregues 30d",
      value: o.successPreps30d.toLocaleString("pt-BR"),
      hint: "Pipeline completo — é o que consome crédito",
    },
    ...legadoPro,
    {
      label: "Cadastros 24h",
      value: o.signups24h.toLocaleString("pt-BR"),
      hint: `${o.signups7d} em 7d · ${o.signups30d} em 30d`,
    },
    {
      // Renomeado: conta linhas de prep_sessions, e desde que a ATS virou
      // grátis a maioria delas nunca vira preparação paga.
      label: "Análises ATS logadas 24h",
      value: o.preps24h.toLocaleString("pt-BR"),
      hint: `${o.preps7d} em 7d · ${o.preps30d} em 30d · grátis`,
    },
    ...anonKpis,
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
      label: "Total de sessões (desde sempre)",
      value: o.totalPreps.toLocaleString("pt-BR"),
      hint: "Grátis e pagas somadas",
    },
    {
      // `generation_status='failed'` só existe em sessão que rodou o pipeline
      // pago — falha de ATS grátis vive em `ats_status` e aparece em /Saúde.
      label: "Preparações pagas falhadas 7d",
      value: o.failedPreps7d.toLocaleString("pt-BR"),
      hint: o.failedPreps7d > 0 ? "Investigar abaixo — crédito devolvido" : undefined,
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

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
